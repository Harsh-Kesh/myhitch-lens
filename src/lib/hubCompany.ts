import "server-only";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalizeAbn } from "@/lib/abn";
import { BillingError, setExtraSeats } from "@/lib/billing";
import { getSeatUsage, inviteToCompany, pendingInvites, resolveLegalEntity, revokeCompanyInvite } from "@/lib/companyTeam";
import { MAX_EXTRA_SEATS } from "@/lib/plans";
import { mintProvenance } from "@/lib/provenance";
import { bearer, hubDenied, verifyHubToken } from "@/lib/hubAuth";

/**
 * The company dashboard for businesses using the MYHitch app, through the
 * MYHitch hub. Mirrors src/app/(portal)/company/actions.ts. A business signed
 * in through the hub is its company's owner, so it can do all of it: team,
 * seats, writing articles and reviewing them. The company's name and ABN come
 * from MYHitch Business and can't be changed here.
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
  if (!user || user.role !== "corporate" || user.suspended) throw new HubError(401, "Please open your Lens account again.");
  const membership = await prisma.orgMembership.findFirst({ where: { userId }, include: { org: true } });
  if (!membership) throw new HubError(403, "No company account found for this user.");
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

export type Ability = "team" | "write" | "review";

export function can(ctx: HubCompany, ability: Ability): boolean {
  if (ctx.membership.isAdmin) return true;
  if (ability === "write") return ctx.membership.orgRole === "author";
  if (ability === "review") return ctx.membership.orgRole === "editor";
  return false;
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
 * Makes [userId] a company account: the hub only opens a session for a
 * business MYHitch has approved, so its Lens account is a company even when
 * it started as an author (e.g. it signed in on the website before the
 * approval). A user already in a company keeps that membership; otherwise a
 * company is made for the business, with them as its owner. Their own
 * articles stay theirs. A suspended account stays refused.
 */
async function ensureCompany(userId: string, business: { name: string; abn: string | null }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, suspended: true } });
  if (!user || user.suspended) throw new HubError(401, "Please open your Lens account again.");
  const membership = await prisma.orgMembership.findFirst({ where: { userId }, select: { id: true } });
  if (user.role === "corporate" && membership) return;
  if (membership) {
    await prisma.user.update({ where: { id: userId }, data: { role: "corporate" } });
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
    prisma.user.update({ where: { id: userId }, data: { role: "corporate" } }),
  ]);
}

/**
 * The Lens company account of a MYHitch business: found by its MYHitch id,
 * else by its email (it's linked then), else made new - a corporate user who
 * owns a new organization. An author account found either way becomes the
 * business's company account (see ensureCompany).
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

type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: Node[] };

function parseDoc(content: string): Node | null {
  try {
    const doc = JSON.parse(content);
    return doc && typeof doc === "object" ? (doc as Node) : null;
  } catch {
    return null;
  }
}

function textOf(node: Node): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(textOf).join("");
}

export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "image"; src: string; alt: string }
  | { type: "code"; text: string }
  | { type: "divider" };

/** The article as simple blocks the app can show. */
export function blocksOf(content: string): Block[] {
  const doc = parseDoc(content);
  if (!doc) return content.trim() ? [{ type: "paragraph", text: content.trim() }] : [];
  const blocks: Block[] = [];
  for (const node of doc.content ?? []) {
    switch (node.type) {
      case "heading":
        blocks.push({ type: "heading", level: Number(node.attrs?.level ?? 2), text: textOf(node) });
        break;
      case "blockquote":
        blocks.push({ type: "quote", text: (node.content ?? []).map(textOf).join("\n") });
        break;
      case "bulletList":
      case "orderedList":
        blocks.push({
          type: "list",
          ordered: node.type === "orderedList",
          items: (node.content ?? []).map((li) => (li.content ?? []).map(textOf).join("\n")),
        });
        break;
      case "image": {
        const src = String(node.attrs?.src ?? "");
        if (/^https:\/\//.test(src)) blocks.push({ type: "image", src, alt: String(node.attrs?.alt ?? "") });
        break;
      }
      case "codeBlock":
        blocks.push({ type: "code", text: textOf(node) });
        break;
      case "horizontalRule":
        blocks.push({ type: "divider" });
        break;
      default: {
        const text = textOf(node);
        if (text.trim()) blocks.push({ type: "paragraph", text });
      }
    }
  }
  return blocks.filter((b) => !("text" in b) || b.text.trim() || b.type === "code");
}

/** The first picture in the article, for its card. */
export function coverOf(content: string): string | null {
  return blocksOf(content).find((b): b is Extract<Block, { type: "image" }> => b.type === "image")?.src ?? null;
}

/** Plain text - and whether the app can edit it without losing formatting. */
function plainOf(content: string): { text: string; editable: boolean } {
  const doc = parseDoc(content);
  if (!doc) return { text: content, editable: true };
  const nodes = doc.content ?? [];
  const editable = nodes.every(
    (n) =>
      n.type === "paragraph" &&
      (n.content ?? []).every((c) => (c.type === "text" && !(c as { marks?: unknown[] }).marks?.length) || c.type === "hardBreak"),
  );
  return { text: blocksOf(content).map((b) => ("text" in b ? b.text : "")).filter(Boolean).join("\n\n"), editable };
}

function docOf(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  });
}

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

const companyArticle = (orgId: string) => ({ author: { memberships: { some: { orgId } } } });

/** Your company's articles - all of them for the owner, else your own. */
export async function listArticles(ctx: HubCompany) {
  const rows = await prisma.article.findMany({
    where: ctx.membership.isAdmin ? companyArticle(ctx.membership.orgId) : { authorId: ctx.user.id },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      content: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      likesCount: true,
      viewsCount: true,
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

async function notifyReviewers(ctx: HubCompany, title: string) {
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
}

/** Writes an article and sends it to the company's review queue. */
export async function createArticle(ctx: HubCompany, input: { title?: unknown; content?: unknown }) {
  need(ctx, "write");
  const { title, content } = checkArticle(input);
  const category = await prisma.category.findFirst({ orderBy: { name: "asc" } });
  if (!category) throw new HubError(500, "No categories configured - contact support.");
  const article = await prisma.article.create({
    data: {
      slug: `${slug(ctx.membership.org.name) || "company"}-${Date.now().toString(36)}`,
      title,
      summary: summaryOf(content),
      content: docOf(content),
      contentType: "Blog",
      status: "in_review",
      // Counts in the month's submissions, as on the website.
      submittedAt: new Date(),
      lane: "public",
      destination: "main_app",
      license: "all_rights_reserved",
      rightsAttested: true,
      authorId: ctx.user.id,
      categoryId: category.id,
    },
    select: { id: true },
  });
  await notifyReviewers(ctx, title);
  refresh();
  return article.id;
}

async function companyArticleOf(ctx: HubCompany, id: string) {
  const article = await prisma.article.findFirst({
    where: { id, ...companyArticle(ctx.membership.orgId) },
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

/** Edits an article; it goes back to the review queue. */
export async function updateArticle(ctx: HubCompany, id: string, input: { title?: unknown; content?: unknown }) {
  need(ctx, "write");
  const article = await editableArticle(ctx, id);
  if (article.status === "archived") throw new HubError(400, "This article was removed.");
  if (!plainOf(article.content).editable) {
    throw new HubError(400, "This article has formatting or pictures - edit it on the Lens website.");
  }
  const { title, content } = checkArticle(input);
  await prisma.article.update({
    where: { id },
    data: { title, summary: summaryOf(content), content: docOf(content), status: "in_review" },
  });
  await notifyReviewers(ctx, title);
  refresh();
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
// Review queue
// ---------------------------------------------------------------------------

export async function reviewQueue(ctx: HubCompany) {
  need(ctx, "review");
  const rows = await prisma.article.findMany({
    where: { status: "in_review", ...companyArticle(ctx.membership.orgId) },
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

export async function approveArticle(ctx: HubCompany, id: string) {
  need(ctx, "review");
  const article = await companyArticleOf(ctx, id);
  if (article.status !== "in_review") throw new HubError(400, "This article isn't waiting for review.");
  await prisma.article.update({
    where: { id },
    data: { status: "published", verified: true, publishedAt: new Date() },
  });
  await mintProvenance(id);
  if (article.authorId !== ctx.user.id) {
    await prisma.notification.create({
      data: { userId: article.authorId, type: "publish", text: `"${article.title}" was approved and published.` },
    });
  }
  refresh();
}

export async function rejectArticle(ctx: HubCompany, id: string, reason: unknown) {
  need(ctx, "review");
  const text = String(reason ?? "").trim();
  if (!text) throw new HubError(400, "A reason is required.");
  if (text.length > 2000) throw new HubError(400, "That reason is too long.");
  const article = await companyArticleOf(ctx, id);
  if (article.status !== "in_review") throw new HubError(400, "This article isn't waiting for review.");
  await prisma.$transaction([
    prisma.article.update({ where: { id }, data: { status: "rejected" } }),
    prisma.revision.create({ data: { articleId: id, editorId: ctx.user.id, note: text } }),
    prisma.notification.create({
      data: { userId: article.authorId, type: "rejected", text: `"${article.title}" was rejected: ${text}` },
    }),
  ]);
  refresh();
}
