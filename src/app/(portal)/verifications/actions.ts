"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ActionResult = { error: string } | { ok: true };

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session.user;
}

async function requireEditor() {
  const session = await auth();
  if (!session?.user || !["editor", "admin"].includes(session.user.role)) {
    throw new Error("Not authorized");
  }
  return session.user;
}

/** Best-effort domain match: does the applicant's email domain match the org? */
function domainMatches(email: string | null | undefined, organisation: string): boolean {
  if (!email || !organisation) return false;
  const emailDomain = email.split("@")[1]?.toLowerCase();
  if (!emailDomain) return false;
  const orgDomain = organisation
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/\s]/)[0];
  return Boolean(orgDomain) && (emailDomain === orgDomain || emailDomain.endsWith(`.${orgDomain}`));
}

/** Author submits (or re-submits) an application for the Verified blue mark. */
export async function requestVerification(input: {
  organisation: string;
  links: string[];
}): Promise<ActionResult> {
  const sessionUser = await requireUser();
  if (!["author", "editor", "admin"].includes(sessionUser.role)) {
    return { error: "Only authors can request verification." };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { email: true, displayName: true, isVerified: true },
  });
  if (!user) return { error: "Account not found." };
  if (user.isVerified) return { error: "You are already verified." };

  const organisation = input.organisation.trim();
  const links = input.links.map((l) => l.trim()).filter(Boolean);
  if (!organisation && links.length === 0) {
    return { error: "Add your organisation or at least one professional link." };
  }
  const domainMatch = domainMatches(user.email, organisation);

  await prisma.authorVerification.upsert({
    where: { userId: sessionUser.id },
    update: {
      state: "pending",
      credentials: { organisation, links },
      domainMatch,
      reviewerNote: null,
      reviewedAt: null,
    },
    create: {
      userId: sessionUser.id,
      state: "pending",
      credentials: { organisation, links },
      domainMatch,
    },
  });

  // Notify reviewers (editors + admins).
  const reviewers = await prisma.user.findMany({
    where: { role: { in: ["editor", "admin"] } },
    select: { id: true },
  });
  if (reviewers.length > 0) {
    await prisma.notification.createMany({
      data: reviewers.map((r) => ({
        userId: r.id,
        type: "verification",
        text: `${user.displayName} applied for author verification.`,
      })),
    });
  }

  revalidatePath("/verifications");
  revalidatePath("/author-dashboard");
  return { ok: true };
}

/** Editor/admin approves an application → grants the blue mark. */
export async function approveVerification(userId: string, note?: string): Promise<ActionResult> {
  await requireEditor();
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  if (!target) return { error: "Applicant not found." };

  await prisma.$transaction([
    prisma.authorVerification.upsert({
      where: { userId },
      update: { state: "approved", reviewedAt: new Date(), reviewerNote: note?.trim() || null },
      create: { userId, state: "approved", reviewedAt: new Date(), reviewerNote: note?.trim() || null },
    }),
    prisma.user.update({ where: { id: userId }, data: { isVerified: true } }),
    prisma.notification.create({
      data: {
        userId,
        type: "verification",
        text: "Your author verification was approved — your Verified badge is now live across the platform.",
      },
    }),
  ]);

  revalidateVerifiedSurfaces();
  return { ok: true };
}

/** Editor/admin rejects an application with a reason. */
export async function rejectVerification(userId: string, note: string): Promise<ActionResult> {
  await requireEditor();
  const text = note.trim();
  if (!text) return { error: "A reason is required so the author can re-apply." };

  await prisma.$transaction([
    prisma.authorVerification.upsert({
      where: { userId },
      update: { state: "rejected", reviewedAt: new Date(), reviewerNote: text },
      create: { userId, state: "rejected", reviewedAt: new Date(), reviewerNote: text },
    }),
    prisma.user.update({ where: { id: userId }, data: { isVerified: false } }),
    prisma.notification.create({
      data: { userId, type: "verification", text: `Your verification request was declined: ${text}. You can re-apply.` },
    }),
  ]);

  revalidateVerifiedSurfaces();
  return { ok: true };
}

/** Editor/admin revokes an existing verification (policy action). */
export async function revokeVerification(userId: string, note: string): Promise<ActionResult> {
  await requireEditor();
  const text = note.trim() || "Verification revoked by the editorial team.";

  await prisma.$transaction([
    prisma.authorVerification.upsert({
      where: { userId },
      update: { state: "rejected", reviewedAt: new Date(), reviewerNote: `Revoked: ${text}` },
      create: { userId, state: "rejected", reviewedAt: new Date(), reviewerNote: `Revoked: ${text}` },
    }),
    prisma.user.update({ where: { id: userId }, data: { isVerified: false } }),
    prisma.notification.create({
      data: { userId, type: "verification", text: `Your Verified badge was removed: ${text}` },
    }),
  ]);

  revalidateVerifiedSurfaces();
  return { ok: true };
}

function revalidateVerifiedSurfaces() {
  revalidatePath("/verifications");
  revalidatePath("/author-dashboard");
  revalidatePath("/explore");
  revalidatePath("/reader-dashboard");
}
