import "server-only";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalizeAbn } from "@/lib/abn";
import { blocksOf, coverOf, docOf, plainOf } from "@/lib/articleBlocks";
import { deriveCategoryFromTags, findCategory } from "@/lib/articleCategory";
import { BillingError, setExtraSeats } from "@/lib/billing";
import {
  companyArticleWhere,
  companyCan,
  ownArticleError,
  submissionAllowanceError,
  type CompanyAbility,
} from "@/lib/companyArticles";
import { getSeatUsage, inviteToCompany, pendingInvites, resolveLegalEntity, revokeCompanyInvite } from "@/lib/companyTeam";
import { MAX_EXTRA_SEATS } from "@/lib/plans";
import { mintProvenance } from "@/lib/provenance";
import { bearer, hubDenied, verifyHubToken } from "@/lib/hubAuth";
import { CONTENT_TYPES } from "@/lib/tagSuggestions";
import { MAX_EXCERPT_CHARS } from "@/lib/titleExcerpt";

/**
 * The company dashboard for businesses using the MYHitch app, through the
 * MYHitch hub. Mirrors src/app/(portal)/company/actions.ts and shares its
 * rules (src/lib/companyArticles.ts). A business signed in through the hub is
 * its company's owner: team, seats, writing articles and reviewing the team's
 * articles - but never its own, which an editor has to approve. The company's
 * name and ABN come from MYHitch Business and can't be changed here.
 */

export class HubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function hubError(e: unknown): NextResponse {
  if (e instanceof HubError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("Lens hub:", e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export type HubCompany = Awaited<ReturnType<typeof companyFor>>;

async function companyFor(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, role: true, suspended: true },
  });
  // A company account, or an individual author who also owns a company (see ensureCompany).
  if (!user || (user.role !== "corporate" && user.role !== "author") || user.suspended) {
    throw new HubError(401, "Please open your Lens account again.");
  }
  const membership = await prisma.orgMembership.findFirst({ where: { userId }, include: { org: true } });
  if (!membership || (user.role === "author" && !membership.isAdmin)) {
    throw new HubError(403, "No company account found for this user.");
  }
  return { user, membership };
}

/** The hub's key and the business's hub session; throws a HubError if not. */
export async function requireHubCompany(request: Request) {
  const denied = hubDenied(request);
  if (denied) throw new HubError(denied.status, denied.status === 501 ? "Lens isn't connected to MYHitch yet." : "Unauthorized");
  const userId = verifyHubToken(bearer(request));
  if (!userId) throw new HubError(401, "Please open your Lens account again.");
  return companyFor(userId);
}

export type Ability = CompanyAbility;

/** The website's rules: authors write, editors review, the owner does both. */
export function can(ctx: HubCompany, ability: Ability): boolean {
  return companyCan(ctx.membership, ability);
}

export function need(ctx: HubCompany, ability: Ability) {
  if (!can(ctx, ability)) {
    throw new HubError(
      403,
      ability === "team"
        ? "Only the company owner can do this."
        : "Your company role can't do this.",
    );
  }
}

function refresh() {
  revalidatePath("/company");
  revalidatePath("/explore");
}

// ---------------------------------------------------------------------------
// Signing in
// ---------------------------------------------------------------------------

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function freeUsername(base: string): Promise<string> {
  const stem = (slug(base).replace(/-/g, "_") || "company").slice(0, 24);
  for (let i = 0; i < 20; i++) {
    const name = i === 0 ? stem : `${stem}_${randomBytes(2).toString("hex")}`;
    if (!(await prisma.user.findUnique({ where: { username: name }, select: { id: true } }))) return name;
  }
  return `${stem}_${randomBytes(4).toString("hex")}`;
}

/**
 * Gives the business a company with [userId] as its owner. The hub only opens
 * a session for a business MYHitch has approved.
 *  - A company account stays one; a legacy reader becomes one (as before).
 *  - An individual author keeps their author account exactly as it is: their
 *    role, /submit, Author Studio, payouts, the Exchange and the staff review
 *    of their own articles. They also own the company; its articles carry the
 *    company (Article.orgId), so the two never mix.
 *  - Lens staff (editor/admin) are refused: a staff account can't also be a
 *    company, so the business needs a different email.
 * A user already in a company keeps that membership. A suspended account
 * stays refused.
 */
async function ensureCompany(userId: string, business: { name: string; abn: string | null }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, suspended: true } });
  if (!user || user.suspended) throw new HubError(401, "Please open your Lens account again.");
  if (user.role === "editor" || user.role === "admin") {
    throw new HubError(
      409,
      "This email's Lens account is a Lens staff account, so it can't also be your company's. Use a different email for your MYHitch business, or contact Lens support.",
    );
  }
  // Only a reader is turned into a company account; an author's role is never changed.
  const becomeCorporate = user.role === "reader";
  const membership = await prisma.orgMembership.findFirst({ where: { userId }, select: { id: true } });
  if (membership) {
    if (becomeCorporate) await prisma.user.update({ where: { id: userId }, data: { role: "corporate" } });
    return;
  }
  await prisma.$transaction([
    prisma.organization.create({
      data: {
        name: business.name,
        abn: business.abn,
        members: { create: { userId, orgRole: "owner", isAdmin: true } },
      },
    }),
    ...(becomeCorporate ? [prisma.user.update({ where: { id: userId }, data: { role: "corporate" } })] : []),
  ]);
}

/**
 * The Lens company account of a MYHitch business: found by its MYHitch id,
 * else by its email (it's linked then), else made new - a corporate user who
 * owns a new organization. An author account found either way stays an
 * author and owns the company too (see ensureCompany).
 */
export async function openHubSession(input: {
  myhitchId: string;
  email: string;
  name: string;
  businessName: string;
  abn?: string;
}): Promise<string> {
  const myhitchId = input.myhitchId.trim();
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim() || input.name.trim();
  if (!myhitchId || !email || !businessName) throw new HubError(400, "myhitchId, email and businessName are required.");

  let abn: string | null = null;
  if (input.abn?.trim()) {
    const normalized = normalizeAbn(input.abn);
    if (/^\d{11}$/.test(normalized)) abn = normalized;
  }
  const business = { name: businessName, abn };

  const linked = await prisma.platformIdentity.findUnique({ where: { myhitchId }, select: { userId: true } });
  if (linked) {
    await ensureCompany(linked.userId, business);
    await companyFor(linked.userId);
    return linked.userId;
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    // Already linked to a different MYHitch account: not this business's.
    const identity = await prisma.platformIdentity.findUnique({ where: { userId: existing.id }, select: { myhitchId: true } });
    if (identity && identity.myhitchId !== myhitchId) {
      throw new HubError(409, "This email's Lens account belongs to another MYHitch account. Log in on the Lens website instead.");
    }
    await ensureCompany(existing.id, business);
    if (!identity) await prisma.platformIdentity.create({ data: { userId: existing.id, myhitchId } });
    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      email,
      username: await freeUsername(businessName),
      // They sign in through MYHitch; this password is never used.
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
      role: "corporate",
      displayName: businessName,
      emailVerified: new Date(),
      profile: { create: {} },
      wallet: { create: {} },
      rank: { create: {} },
      platformIdentity: { create: { myhitchId } },
    },
    select: { id: true },
  });
  await prisma.organization.create({
    data: {
      name: businessName,
      abn,
      members: { create: { userId: user.id, orgRole: "owner", isAdmin: true } },
    },
  });
  return user.id;
}

// ---------------------------------------------------------------------------
// Company and team
// ---------------------------------------------------------------------------

export async function overview(ctx: HubCompany) {
  const { membership } = ctx;
  // As the website's company dashboard: the owner's name and ABN come live from MYHitch Business.
  const legal = membership.isAdmin
    ? await resolveLegalEntity(ctx.user.id, membership.org)
    : { name: membership.org.name, abn: membership.org.abn, fromPortal: false };
  const [members, seatUsage, invites] = await Promise.all([
    prisma.orgMembership.findMany({
      where: { orgId: membership.orgId },
      orderBy: { id: "asc" },
      include: { user: { select: { username: true, displayName: true, email: true, createdAt: true } } },
    }),
    getSeatUsage(membership.orgId),
    membership.isAdmin ? pendingInvites(membership.orgId) : Promise.resolve([]),
  ]);
  return {
    orgId: membership.orgId,
    orgName: legal.name,
    abn: legal.abn,
    fromPortal: legal.fromPortal,
    myRole: membership.orgRole,
    isOwner: membership.isAdmin,
    can: { team: can(ctx, "team"), write: can(ctx, "write"), review: can(ctx, "review") },
    // Kept for older app builds: the seats the plan covers.
    seats: seatUsage.total,
    extraSeats: seatUsage.extra,
    seatUsage,
    members: members.map((m) => ({
      id: m.userId,
      username: m.user.username,
      displayName: m.user.displayName,
      email: m.user.email,
      orgRole: m.orgRole,
      isAdmin: m.isAdmin,
      isMe: m.userId === ctx.user.id,
      createdAt: m.user.createdAt.toISOString(),
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      displayName: i.displayName,
      orgRole: i.orgRole,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

/** The company's name and ABN are MYHitch Business's; the app can't change them. */
export function updateDetails(): never {
  throw new HubError(403, "Your company's name and ABN come from your MYHitch Business details.");
}

/** The old username/password sub-accounts are gone: the team is built by invite. */
export function addMember(): never {
  throw new HubError(410, "Team members are added by invite now.");
}

/** Invites someone as an author or editor (owner); same rules as the website. */
export async function inviteMember(
  ctx: HubCompany,
  input: { email?: unknown; displayName?: unknown; orgRole?: unknown },
): Promise<string> {
  need(ctx, "team");
  const result = await inviteToCompany(
    { userId: ctx.user.id, orgId: ctx.membership.orgId },
    { email: String(input.email ?? ""), displayName: String(input.displayName ?? ""), orgRole: String(input.orgRole ?? "") },
  );
  if ("error" in result) throw new HubError(result.status, result.error);
  refresh();
  return result.id;
}

export async function revokeInvite(ctx: HubCompany, inviteId: string) {
  need(ctx, "team");
  const result = await revokeCompanyInvite(ctx.membership.orgId, inviteId);
  if ("error" in result) throw new HubError(result.status, result.error);
  refresh();
}

/** Extra users on the owner's Business subscription (prorated by Stripe). */
export async function setSeats(ctx: HubCompany, input: { extraSeats?: unknown }) {
  need(ctx, "team");
  const raw = input.extraSeats;
  const count = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(count) || count < 0 || count > MAX_EXTRA_SEATS) {
    throw new HubError(400, `Choose between 0 and ${MAX_EXTRA_SEATS} extra users.`);
  }
  try {
    await setExtraSeats(ctx.user.id, count);
  } catch (error) {
    if (error instanceof BillingError) throw new HubError(400, error.message);
    console.error("[company] extra seats failed", { error: error instanceof Error ? error.message : String(error) });
    throw new HubError(502, "Couldn't update your extra users right now. Please try again shortly.");
  }
  refresh();
  const seatUsage = await getSeatUsage(ctx.membership.orgId);
  return { extraSeats: seatUsage.extra, seatUsage };
}

export async function removeMember(ctx: HubCompany, userId: string) {
  need(ctx, "team");
  if (userId === ctx.user.id) throw new HubError(400, "You can't remove yourself.");
  const target = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId: ctx.membership.orgId, userId } },
  });
  if (!target) throw new HubError(404, "That member isn't part of your company.");
  if (target.isAdmin) throw new HubError(400, "Can't remove another owner.");
  await prisma.orgMembership.delete({ where: { id: target.id } });
  refresh();
}

// ---------------------------------------------------------------------------
// Articles - stored as TipTap documents (JSON). The app writes plain text:
// paragraphs split by blank lines.
// ---------------------------------------------------------------------------

export { blocksOf, coverOf, readingOf, type Block, type Span } from "@/lib/articleBlocks";

function summaryOf(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 137).trimEnd()}...` : flat;
}

function checkArticle(input: { title?: unknown; content?: unknown }) {
  const title = String(input.title ?? "").trim();
  const content = String(input.content ?? "").trim();
  if (!title) throw new HubError(400, "Add a title.");
  if (title.length > 200) throw new HubError(400, "That title is too long.");
  if (content.length < 50) throw new HubError(400, "Write at least a few sentences.");
  if (content.length > 100_000) throw new HubError(400, "That article is too long for the app - use the Lens website.");
  return { title, content };
}

export type ArticleInput = {
  title?: unknown;
  content?: unknown;
  /** A category's slug (or name), from GET /api/hub/categories. */
  category?: unknown;
  /** Blog, News, Report or Research Paper. */
  type?: unknown;
  /** The excerpt shown on cards; blank = the start of the article. */
  summary?: unknown;
  /** Up to MAX_TAGS tag names. */
  tags?: unknown;
};

/** As the website's submit page. */
const MAX_TAGS = 5;
const MAX_TAG_CHARS = 40;

/**
 * The category, type, summary and tags the app sent, checked. A field that
 * wasn't sent is undefined (an older app build): it's left as it is.
 */
async function articleMeta(input: ArticleInput) {
  let type: string | undefined;
  if (input.type !== undefined && input.type !== null && input.type !== "") {
    type = String(input.type).trim();
    if (!(CONTENT_TYPES as readonly string[]).includes(type)) {
      throw new HubError(400, `Choose a type: ${CONTENT_TYPES.join(", ")}.`);
    }
  }

  let categoryId: string | undefined;
  if (input.category !== undefined && input.category !== null && input.category !== "") {
    const category = await findCategory(String(input.category));
    if (!category) throw new HubError(400, "Choose one of Lens's categories.");
    categoryId = category.id;
  }

  let summary: string | undefined;
  if (input.summary !== undefined && input.summary !== null) {
    summary = String(input.summary).replace(/\s+/g, " ").trim();
    if (summary.length > MAX_EXCERPT_CHARS) {
      throw new HubError(400, `Keep the summary to ${MAX_EXCERPT_CHARS} characters.`);
    }
  }

  let tags: string[] | undefined;
  if (input.tags !== undefined && input.tags !== null) {
    if (!Array.isArray(input.tags)) throw new HubError(400, "Tags should be a list.");
    const seen = new Set<string>();
    tags = [];
    for (const raw of input.tags) {
      const name = String(raw ?? "").replace(/\s+/g, " ").trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      if (name.length > MAX_TAG_CHARS) throw new HubError(400, `Keep each tag to ${MAX_TAG_CHARS} characters.`);
      seen.add(name.toLowerCase());
      tags.push(name);
    }
    if (tags.length > MAX_TAGS) throw new HubError(400, `Maximum ${MAX_TAGS} tags.`);
  }
  return { type, categoryId, summary, tags };
}

/** Tag ids for these names, reusing a tag that differs only in case. */
async function tagIds(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const existing = await prisma.tag.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    ids.push(existing?.id ?? (await prisma.tag.upsert({ where: { name }, update: {}, create: { name }, select: { id: true } })).id);
  }
  return ids;
}

/** Your company's articles - all of them for the owner, else your own. */
export async function listArticles(ctx: HubCompany) {
  const company = companyArticleWhere(ctx.membership.orgId);
  const rows = await prisma.article.findMany({
    where: ctx.membership.isAdmin ? company : { authorId: ctx.user.id, ...company },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      content: true,
      contentType: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      likesCount: true,
      viewsCount: true,
      category: { select: { slug: true, name: true } },
      tags: { select: { tag: { select: { name: true } } } },
      author: { select: { id: true, displayName: true } },
      revisions: { orderBy: { createdAt: "desc" }, take: 1, select: { note: true } },
    },
  });
  return rows.map((r) => {
    const plain = plainOf(r.content);
    return {
      id: r.id,
      slug: r.slug,
      title: r.title || "(untitled)",
      summary: r.summary,
      content: plain.text,
      editableInApp: plain.editable,
      cover: coverOf(r.content),
      status: r.status,
      type: r.contentType,
      category: r.category.slug,
      categoryName: r.category.name,
      tags: r.tags.map((t) => t.tag.name),
      authorId: r.author.id,
      authorName: r.author.displayName,
      mine: r.author.id === ctx.user.id,
      likes: r.likesCount,
      views: r.viewsCount,
      lastNote: r.status === "rejected" || r.status === "changes_requested" ? r.revisions[0]?.note ?? null : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      publishedAt: r.publishedAt?.toISOString() ?? null,
    };
  });
}

/** Tells the company's reviewers (not the writer); how many there are. */
async function notifyReviewers(ctx: HubCompany, title: string): Promise<number> {
  const editors = await prisma.orgMembership.findMany({
    where: { orgId: ctx.membership.orgId, OR: [{ orgRole: "editor" }, { isAdmin: true }], userId: { not: ctx.user.id } },
    select: { userId: true },
  });
  if (editors.length > 0) {
    await prisma.notification.createMany({
      data: editors.map((e) => ({
        userId: e.userId,
        type: "company_submitted",
        text: `${ctx.user.displayName} submitted "${title}" for your review.`,
      })),
    });
  }
  return editors.length;
}

/**
 * Writes an article and sends it to the company's review queue. [reviewers]
 * is how many others can approve it: 0 means the owner wrote it and has no
 * editor yet, so it waits until they invite one.
 */
export async function createArticle(ctx: HubCompany, input: ArticleInput): Promise<{ id: string; reviewers: number }> {
  need(ctx, "write");
  const { title, content } = checkArticle(input);
  const meta = await articleMeta(input);
  // A first submission counts against the plan's monthly allowance, as on the website.
  const overAllowance = await submissionAllowanceError(ctx.user.id);
  if (overAllowance) throw new HubError(403, overAllowance);

  const categoryId =
    meta.categoryId ??
    (meta.tags?.length ? await deriveCategoryFromTags(meta.tags) : (await prisma.category.findFirst({ orderBy: { name: "asc" } }))?.id);
  if (!categoryId) throw new HubError(500, "No categories configured - contact support.");
  const article = await prisma.article.create({
    data: {
      slug: `${slug(ctx.membership.org.name) || "company"}-${Date.now().toString(36)}`,
      title,
      summary: meta.summary || summaryOf(content),
      content: docOf(content),
      contentType: meta.type ?? "Blog",
      status: "in_review",
      // Counts in the month's submissions, as on the website.
      submittedAt: new Date(),
      lane: "public",
      destination: "main_app",
      license: "all_rights_reserved",
      rightsAttested: true,
      authorId: ctx.user.id,
      categoryId,
      orgId: ctx.membership.orgId,
      ...(meta.tags?.length ? { tags: { create: (await tagIds(meta.tags)).map((tagId) => ({ tagId })) } } : {}),
    },
    select: { id: true },
  });
  const reviewers = await notifyReviewers(ctx, title);
  refresh();
  return { id: article.id, reviewers };
}

async function companyArticleOf(ctx: HubCompany, id: string) {
  const article = await prisma.article.findFirst({
    where: { id, ...companyArticleWhere(ctx.membership.orgId) },
    select: { id: true, title: true, content: true, status: true, authorId: true, provenance: { select: { id: true } } },
  });
  if (!article) throw new HubError(404, "Article not found.");
  return article;
}

/** Your own (or, for the owner, any company) article. */
async function editableArticle(ctx: HubCompany, id: string) {
  const article = await companyArticleOf(ctx, id);
  if (!ctx.membership.isAdmin && article.authorId !== ctx.user.id) throw new HubError(403, "That isn't your article.");
  return article;
}

/**
 * Edits an article; it goes back to the review queue. A published article is
 * taken off Lens until it's approved again (the app warns before saving).
 */
export async function updateArticle(ctx: HubCompany, id: string, input: ArticleInput): Promise<{ reviewers: number }> {
  need(ctx, "write");
  const article = await editableArticle(ctx, id);
  if (article.status === "archived") throw new HubError(400, "This article was removed.");
  if (!plainOf(article.content).editable) {
    throw new HubError(400, "This article has formatting or pictures - edit it on the Lens website.");
  }
  const { title, content } = checkArticle(input);
  const meta = await articleMeta(input);
  await prisma.article.update({
    where: { id },
    data: {
      title,
      summary: meta.summary || summaryOf(content),
      content: docOf(content),
      status: "in_review",
      ...(meta.type ? { contentType: meta.type } : {}),
      ...(meta.categoryId ? { categoryId: meta.categoryId } : {}),
      ...(meta.tags ? { tags: { deleteMany: {}, create: (await tagIds(meta.tags)).map((tagId) => ({ tagId })) } } : {}),
    },
  });
  const reviewers = await notifyReviewers(ctx, title);
  refresh();
  return { reviewers };
}

/**
 * Removes an article: deleted if it was never published, otherwise
 * archived (taken down; its provenance record is kept).
 */
export async function deleteArticle(ctx: HubCompany, id: string): Promise<"deleted" | "archived"> {
  need(ctx, "write");
  const article = await editableArticle(ctx, id);
  const wasPublic = article.provenance != null || ["published", "scheduled", "approved", "archived"].includes(article.status);
  if (!wasPublic) {
    try {
      await prisma.article.delete({ where: { id } });
      refresh();
      return "deleted";
    } catch {
      // Something still refers to it - take it down instead.
    }
  }
  await prisma.article.update({ where: { id }, data: { status: "archived" } });
  refresh();
  return "archived";
}

// ---------------------------------------------------------------------------
// Review queue - the team's articles; your own wait for someone else.
// ---------------------------------------------------------------------------

export async function reviewQueue(ctx: HubCompany) {
  need(ctx, "review");
  const rows = await prisma.article.findMany({
    where: { status: "in_review", authorId: { not: ctx.user.id }, ...companyArticleWhere(ctx.membership.orgId) },
    orderBy: { updatedAt: "asc" },
    select: { id: true, title: true, content: true, updatedAt: true, author: { select: { displayName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    authorName: r.author.displayName,
    submittedAt: r.updatedAt.toISOString(),
    blocks: blocksOf(r.content),
  }));
}

/** A company article [ctx] may review now: not their own, and waiting for review. */
async function reviewableArticle(ctx: HubCompany, id: string) {
  need(ctx, "review");
  const article = await companyArticleOf(ctx, id);
  const own = ownArticleError(article, ctx.user.id);
  if (own) throw new HubError(403, own);
  if (article.status !== "in_review") throw new HubError(400, "This article isn't waiting for review.");
  return article;
}

export async function approveArticle(ctx: HubCompany, id: string) {
  const article = await reviewableArticle(ctx, id);
  await prisma.article.update({
    where: { id },
    data: { status: "published", verified: true, publishedAt: new Date() },
  });
  await mintProvenance(id);
  await prisma.notification.create({
    data: { userId: article.authorId, type: "publish", text: `"${article.title}" was approved and published.` },
  });
  refresh();
}

export async function rejectArticle(ctx: HubCompany, id: string, reason: unknown) {
  need(ctx, "review");
  const text = String(reason ?? "").trim();
  if (!text) throw new HubError(400, "A reason is required.");
  if (text.length > 2000) throw new HubError(400, "That reason is too long.");
  const article = await reviewableArticle(ctx, id);
  await prisma.$transaction([
    prisma.article.update({ where: { id }, data: { status: "rejected" } }),
    prisma.revision.create({ data: { articleId: id, editorId: ctx.user.id, note: text } }),
    prisma.notification.create({
      data: { userId: article.authorId, type: "rejected", text: `"${article.title}" was rejected: ${text}` },
    }),
  ]);
  refresh();
}
