"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeAbn } from "@/lib/abn";
import { loadPortalBusiness, loadPortalProfile } from "@/lib/portalDb";
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
  abn: string | null;
  /** True when name/ABN were read live from the MYHitch Business portal (the source of truth). */
  fromPortal: boolean;
  seats: number;
  myRole: OrgRole;
  isOwner: boolean;
  members: CompanyMember[];
  /** Owner-only: invitations not yet accepted. Empty for everyone else. */
  invites: CompanyInvite[];
}

export interface CompanyInvite {
  id: string;
  email: string;
  displayName: string;
  orgRole: OrgRole;
  createdAt: string;
}

/**
 * The company's legal name and ABN are owned by the MYHitch Business portal.
 * For the OWNER (who is the portal business holder) read them live, and keep
 * Lens's own Organization row in step so everything else that uses it (slugs,
 * other members' views) stays right. If the portal is unreachable or has no
 * approved business, fall back silently to what Lens already has — never fail
 * the page. Lens never writes back to the portal.
 */
async function resolveLegalEntity(
  userId: string,
  org: { id: string; name: string; abn: string | null },
): Promise<{ name: string; abn: string | null; fromPortal: boolean }> {
  const local = { name: org.name, abn: org.abn, fromPortal: false };
  try {
    const identity = await prisma.platformIdentity.findUnique({ where: { userId }, select: { myhitchId: true } });
    if (!identity) return local;
    const profile = await loadPortalProfile(identity.myhitchId);
    if (!profile) return local;
    const business = await loadPortalBusiness(profile.profileId);
    const name = business?.legalEntityName || business?.tradingName || null;
    if (business?.reviewStatus !== "approved" || !name) return local;

    const abn = business.abn ? normalizeAbn(business.abn) : null;
    if (name !== org.name || abn !== org.abn) {
      await prisma.organization.update({ where: { id: org.id }, data: { name, abn } });
    }
    return { name, abn, fromPortal: true };
  } catch (error) {
    console.error("[company] portal business lookup failed; using local details", {
      error: error instanceof Error ? error.message : String(error),
    });
    return local;
  }
}

/** Everything the company dashboard needs, branched by the viewer's own role. */
export async function getCompanyOverview(): Promise<CompanyOverview> {
  const { user, membership } = await requireMembership();
  const legal = membership.isAdmin
    ? await resolveLegalEntity(user.id, membership.org)
    : { name: membership.org.name, abn: membership.org.abn, fromPortal: false };

  const members = await prisma.orgMembership.findMany({
    where: { orgId: membership.orgId },
    orderBy: { id: "asc" },
    include: { user: { select: { username: true, displayName: true, createdAt: true } } },
  });
  const invites = membership.isAdmin
    ? await prisma.orgInvite.findMany({
        where: { orgId: membership.orgId, acceptedAt: null },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return {
    orgId: membership.orgId,
    orgName: legal.name,
    abn: legal.abn,
    fromPortal: legal.fromPortal,
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
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      displayName: i.displayName,
      orgRole: i.orgRole,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Owner-only: invite someone to the company as an author or editor. No
 * password is set: the invite is activated when that person signs in through
 * the MYHitch Business portal with this same verified email.
 */
export async function inviteSubAccount(input: {
  email: string;
  displayName: string;
  orgRole: "author" | "editor";
}): Promise<ActionResult> {
  const { membership, user } = await requireOwner();

  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!email || !displayName) return { error: "Fill in the email and display name." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (input.orgRole !== "author" && input.orgRole !== "editor") return { error: "Choose a role." };

  // Invites count against seats just like members, so owners can't over-invite.
  const [memberCount, pendingCount] = await Promise.all([
    prisma.orgMembership.count({ where: { orgId: membership.orgId } }),
    prisma.orgInvite.count({ where: { orgId: membership.orgId, acceptedAt: null } }),
  ]);
  if (memberCount + pendingCount >= membership.org.seats) {
    return { error: `You've used all ${membership.org.seats} seats on your plan.` };
  }

  // One person can only belong to one company, and platform authors/staff keep
  // their own role (an invite never converts them).
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { role: true, memberships: { select: { id: true }, take: 1 } },
  });
  if (existing) {
    if (existing.memberships.length > 0) return { error: "That person already belongs to a company." };
    if (existing.role !== "reader" && existing.role !== "corporate") {
      return { error: "That email belongs to an existing author or staff account and can't be invited." };
    }
  }

  const duplicate = await prisma.orgInvite.findUnique({
    where: { orgId_email: { orgId: membership.orgId, email } },
  });
  if (duplicate && duplicate.acceptedAt === null) return { error: "That email has already been invited." };

  if (duplicate) {
    // A previously accepted invite for this email (member was removed): re-invite.
    await prisma.orgInvite.update({
      where: { id: duplicate.id },
      data: { displayName, orgRole: input.orgRole, acceptedAt: null, invitedById: user.id, createdAt: new Date() },
    });
  } else {
    await prisma.orgInvite.create({
      data: { orgId: membership.orgId, email, displayName, orgRole: input.orgRole, invitedById: user.id },
    });
  }

  revalidatePath("/company");
  return { ok: true };
}

/** Owner-only: cancel a pending invitation. */
export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const { membership } = await requireOwner();
  const result = await prisma.orgInvite.deleteMany({
    where: { id: inviteId, orgId: membership.orgId, acceptedAt: null },
  });
  if (result.count !== 1) return { error: "That invitation no longer exists." };
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
