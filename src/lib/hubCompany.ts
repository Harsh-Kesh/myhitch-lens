import "server-only";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { OrgRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { lookupAbn, normalizeAbn } from "@/lib/abn";
import { mintProvenance } from "@/lib/provenance";
import { bearer, hubDenied, verifyHubToken } from "@/lib/hubAuth";

/**
 * The company dashboard for businesses using the MYHitch app, through the
 * MYHitch hub. Mirrors src/app/(portal)/company/actions.ts. A business signed
 * in through the hub is its company's owner, so it can do all of it: team,
 * company details, writing articles and reviewing them.
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

type Ability = "team" | "write" | "review";

function can(ctx: HubCompany, ability: Ability): boolean {
  if (ctx.membership.isAdmin) return true;
  if (ability === "write") return ctx.membership.orgRole === "author";
  if (ability === "review") return ctx.membership.orgRole === "editor";
  return false;
}

function need(ctx: HubCompany, ability: Ability) {
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
 * The Lens company account of a MYHitch business: found by its MYHitch id,
 * else by its email if that's already a Lens company account (it's linked
 * then), else made new - a corporate user who owns a new organization.
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

  const linked = await prisma.platformIdentity.findUnique({ where: { myhitchId }, select: { userId: true } });
  if (linked) {
    await companyFor(linked.userId);
    return linked.userId;
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    const membership =
      existing.role === "corporate"
        ? await prisma.orgMembership.findFirst({ where: { userId: existing.id }, select: { id: true } })
        : null;
    const identity = await prisma.platformIdentity.findUnique({ where: { userId: existing.id }, select: { id: true } });
    if (!membership || identity) {
      throw new HubError(409, "This email already has a Lens account that isn't a company account. Log in on the Lens website instead.");
    }
    await prisma.platformIdentity.create({ data: { userId: existing.id, myhitchId } });
    return existing.id;
  }

  let abn: string | null = null;
  if (input.abn?.trim()) {
    const normalized = normalizeAbn(input.abn);
    if (/^\d{11}$/.test(normalized)) abn = normalized;
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
  const members = await prisma.orgMembership.findMany({
    where: { orgId: membership.orgId },
    orderBy: { id: "asc" },
    include: { user: { select: { username: true, displayName: true, email: true, createdAt: true } } },
  });
  return {
    orgId: membership.orgId,
    orgName: membership.org.name,
    abn: membership.org.abn,
    seats: membership.org.seats,
    myRole: membership.orgRole,
    isOwner: membership.isAdmin,
    can: { team: can(ctx, "team"), write: can(ctx, "write"), review: can(ctx, "review") },
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
  };
}

export async function updateDetails(ctx: HubCompany, input: { name?: unknown; abn?: unknown }) {
  need(ctx, "team");
  const name = String(input.name ?? "").trim();
  if (!name) throw new HubError(400, "Company name can't be empty.");
  const abnInput = String(input.abn ?? "").trim();
  let abn: string | null = null;
  if (abnInput) {
    const check = await lookupAbn(abnInput);
    if (!check.valid) throw new HubError(400, check.error ?? "That ABN doesn't look valid.");
    abn = normalizeAbn(abnInput);
  }
  await prisma.organization.update({ where: { id: ctx.membership.orgId }, data: { name, abn } });
  refresh();
}

export async function addMember(
  ctx: HubCompany,
  input: { username?: unknown; email?: unknown; password?: unknown; displayName?: unknown; orgRole?: unknown },
) {
  need(ctx, "team");
  const username = String(input.username ?? "").trim().toLowerCase();
  const email = String(input.email ?? "").trim().toLowerCase();
  const displayName = String(input.displayName ?? "").trim();
  const password = String(input.password ?? "");
  const orgRole = input.orgRole === "editor" ? "editor" : input.orgRole === "author" ? "author" : null;
  if (!username || !email || !displayName) throw new HubError(400, "Fill in username, email, and display name.");
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) throw new HubError(400, "Usernames are 3-30 letters, numbers, dots, dashes or underscores.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HubError(400, "That email doesn't look right.");
  if (password.length < 8) throw new HubError(400, "Password must be at least 8 characters.");
  if (!orgRole) throw new HubError(400, "Pick author or editor.");

  const seatCount = await prisma.orgMembership.count({ where: { orgId: ctx.membership.orgId } });
  if (seatCount >= ctx.membership.org.seats) {
    throw new HubError(400, `You've used all ${ctx.membership.org.seats} seats on your plan.`);
  }
  const taken = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] }, select: { id: true } });
  if (taken) throw new HubError(409, "That username or email is already registered.");

  await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "corporate",
      displayName,
      profile: { create: {} },
      wallet: { create: {} },
      rank: { create: {} },
      memberships: { create: { orgId: ctx.membership.orgId, orgRole: orgRole as OrgRole, isAdmin: false } },
    },
  });
  refresh();
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
