"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { mintProvenance } from "@/lib/provenance";
import type { OrgRole } from "@prisma/client";

export type ActionResult = { error: string } | { ok: true };

/**
 * Company sub-accounts all share the platform's "corporate" User.role — never
 * "author"/"editor" — so they're automatically excluded from every existing
 * author/editor-gated route (submit, editorial queue, trust & safety,
 * analytics, etc). What a member can actually do is determined entirely by
 * their OrgMembership.orgRole (owner/editor/author), checked here.
 */
async function requireMembership() {
  const session = await auth();
  if (!session?.user || session.user.role !== "corporate") throw new Error("Not authorized");
  const membership = await prisma.orgMembership.findFirst({
    where: { userId: session.user.id },
    include: { org: true },
  });
  if (!membership) throw new Error("No company account found for this user.");
  return { user: session.user, membership };
}

async function requireOwner() {
  const ctx = await requireMembership();
  if (!ctx.membership.isAdmin) throw new Error("Only the company owner can do this.");
  return ctx;
}

async function requireOrgRole(role: OrgRole) {
  const ctx = await requireMembership();
  if (ctx.membership.orgRole !== role) throw new Error("Not authorized for this action.");
  return ctx;
}

export interface CompanyMember {
  id: string;
  username: string;
  displayName: string;
  orgRole: OrgRole;
  isAdmin: boolean;
  createdAt: string;
}

export interface CompanyOverview {
  orgId: string;
  orgName: string;
  seats: number;
  myRole: OrgRole;
  isOwner: boolean;
  members: CompanyMember[];
}

/** Everything the company dashboard needs, branched by the viewer's own role. */
export async function getCompanyOverview(): Promise<CompanyOverview> {
  const { membership } = await requireMembership();

  const members = await prisma.orgMembership.findMany({
    where: { orgId: membership.orgId },
    orderBy: { id: "asc" },
    include: { user: { select: { username: true, displayName: true, createdAt: true } } },
  });

  return {
    orgId: membership.orgId,
    orgName: membership.org.name,
    seats: membership.org.seats,
    myRole: membership.orgRole,
    isOwner: membership.isAdmin,
    members: members.map((m) => ({
      id: m.userId,
      username: m.user.username,
      displayName: m.user.displayName,
      orgRole: m.orgRole,
      isAdmin: m.isAdmin,
      createdAt: m.user.createdAt.toISOString(),
    })),
  };
}

/** Owner-only: create a sub-account (author or editor) under the company. */
export async function createSubAccount(input: {
  username: string;
  email: string;
  password: string;
  displayName: string;
  orgRole: "author" | "editor";
}): Promise<ActionResult> {
  const { membership } = await requireOwner();

  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!username || !email || !displayName) {
    return { error: "Fill in username, email, and display name." };
  }
  if (input.password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const seatCount = await prisma.orgMembership.count({ where: { orgId: membership.orgId } });
  if (seatCount >= membership.org.seats) {
    return { error: `You've used all ${membership.org.seats} seats on your plan.` };
  }

  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (existing) return { error: "That username or email is already registered." };

  const passwordHash = await bcrypt.hash(input.password, 10);

  await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role: "corporate",
      displayName,
      profile: { create: {} },
      wallet: { create: {} },
      rank: { create: {} },
      memberships: {
        create: { orgId: membership.orgId, orgRole: input.orgRole, isAdmin: false },
      },
    },
  });

  revalidatePath("/company");
  return { ok: true };
}

/** Owner-only: revoke a sub-account's company access (the User itself is kept, not deleted). */
export async function removeSubAccount(userId: string): Promise<ActionResult> {
  const { membership, user } = await requireOwner();
  if (userId === user.id) return { error: "You can't remove yourself." };

  const target = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId: membership.orgId, userId } },
  });
  if (!target) return { error: "That member isn't part of your company." };
  if (target.isAdmin) return { error: "Can't remove another owner." };

  await prisma.orgMembership.delete({ where: { id: target.id } });

  revalidatePath("/company");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Company authoring — a deliberately simple composer for now (plain text, no
// rich formatting yet) so a sub-account author has something real to submit
// and a company editor has something real to review.
// ---------------------------------------------------------------------------

export interface CompanyArticle {
  id: string;
  title: string;
  status: string;
  authorName: string;
  createdAt: string;
}

/** The signed-in author sub-account's own articles. */
export async function listMyCompanyArticles(): Promise<CompanyArticle[]> {
  const { user } = await requireOrgRole("author");
  const rows = await prisma.article.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, createdAt: true, author: { select: { displayName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title || "(untitled)",
    status: r.status,
    authorName: r.author.displayName,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Author sub-account: write and submit an article in one step. */
export async function submitCompanyArticle(input: { title: string; content: string }): Promise<ActionResult> {
  const { user, membership } = await requireOrgRole("author");

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) return { error: "Add a title." };
  if (content.length < 50) return { error: "Write at least a few sentences." };

  const category = await prisma.category.findFirst();
  if (!category) return { error: "No categories configured — contact support." };

  await prisma.article.create({
    data: {
      slug: `${membership.org.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
      title,
      summary: content.slice(0, 140),
      content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: content }] }] }),
      contentType: "Blog",
      status: "in_review",
      lane: "public",
      destination: "main_app",
      license: "all_rights_reserved",
      rightsAttested: true,
      authorId: user.id,
      categoryId: category.id,
    },
  });

  // Notify this company's own editors — not platform staff.
  const editors = await prisma.orgMembership.findMany({
    where: { orgId: membership.orgId, orgRole: "editor" },
    select: { userId: true },
  });
  if (editors.length > 0) {
    await prisma.notification.createMany({
      data: editors.map((e) => ({
        userId: e.userId,
        type: "company_submitted",
        text: `${user.name ?? "An author"} submitted "${title}" for your review.`,
      })),
    });
  }

  revalidatePath("/company");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Company review queue — an editor sub-account approves/rejects only their
// own company's authors, never anyone else's. Mirrors the platform's global
// editorial actions (src/app/(portal)/editorial/actions.ts) but scoped to
// same-org authorship, since that global queue and this one must never
// overlap (see the `author.role !== "corporate"` filter in listReviewQueue()).
// ---------------------------------------------------------------------------

export interface CompanyReviewItem {
  id: string;
  title: string;
  authorName: string;
  submittedAt: string;
  content: string;
}

export async function listCompanyReviewQueue(): Promise<CompanyReviewItem[]> {
  const { membership } = await requireOrgRole("editor");
  const rows = await prisma.article.findMany({
    where: {
      status: "in_review",
      author: { memberships: { some: { orgId: membership.orgId } } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, content: true, createdAt: true, author: { select: { displayName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    authorName: r.author.displayName,
    submittedAt: r.createdAt.toISOString(),
    content: r.content,
  }));
}

async function requireSameOrgArticle(membership: { orgId: string }, articleId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, title: true, authorId: true, author: { select: { memberships: { select: { orgId: true } } } } },
  });
  if (!article) throw new Error("Article not found.");
  if (!article.author.memberships.some((m) => m.orgId === membership.orgId)) {
    throw new Error("Not your company's article.");
  }
  return article;
}

export async function approveCompanyArticle(articleId: string): Promise<ActionResult> {
  const { membership } = await requireOrgRole("editor");
  const article = await requireSameOrgArticle(membership, articleId);

  await prisma.article.update({
    where: { id: articleId },
    data: { status: "published", verified: true, publishedAt: new Date() },
  });
  await mintProvenance(articleId);
  await prisma.notification.create({
    data: { userId: article.authorId, type: "publish", text: `"${article.title}" was approved and published.` },
  });

  revalidatePath("/company");
  revalidatePath("/explore");
  return { ok: true };
}

export async function rejectCompanyArticle(articleId: string, reason: string): Promise<ActionResult> {
  const { user, membership } = await requireOrgRole("editor");
  const text = reason.trim();
  if (!text) return { error: "A reason is required." };
  const article = await requireSameOrgArticle(membership, articleId);

  await prisma.$transaction([
    prisma.article.update({ where: { id: articleId }, data: { status: "rejected" } }),
    prisma.revision.create({ data: { articleId, editorId: user.id, note: text } }),
    prisma.notification.create({
      data: { userId: article.authorId, type: "rejected", text: `"${article.title}" was rejected: ${text}` },
    }),
  ]);

  revalidatePath("/company");
  return { ok: true };
}
