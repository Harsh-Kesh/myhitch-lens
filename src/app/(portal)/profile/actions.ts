"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

import { auth, updateSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ABN_COUNTRY } from "@/lib/platformConfig";
import { lookupAbn, normalizeAbn } from "@/lib/abn";
import { syncVerification } from "@/lib/verification";

export type ActionResult = { error: string } | { ok: true };
export type ProfileUpdateResult = { error: string } | { ok: true; abnEntityName?: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session.user;
}

export async function updateProfile(input: {
  displayName: string;
  bio: string;
  website: string;
  country: string;
  abn: string;
}): Promise<ProfileUpdateResult> {
  const user = await requireUser();

  const displayName = input.displayName.trim();
  if (!displayName) return { error: "Display name can't be empty." };

  const country = input.country.trim();
  const abnInput = country === ABN_COUNTRY ? input.abn.trim() || null : null;

  let abn: string | null = null;
  let abnEntityName: string | undefined;
  if (abnInput) {
    const check = await lookupAbn(abnInput);
    if (!check.valid) return { error: check.error ?? "That ABN doesn't look valid." };
    abn = normalizeAbn(abnInput);
    abnEntityName = check.entityName;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { displayName } }),
    prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        bio: input.bio.trim() || null,
        website: input.website.trim() || null,
        country: country || null,
        abn,
      },
      create: {
        userId: user.id,
        bio: input.bio.trim() || null,
        website: input.website.trim() || null,
        country: country || null,
        abn,
      },
    }),
  ]);
  await syncVerification(user.id);

  revalidatePath("/profile", "layout");
  return { ok: true, abnEntityName };
}

/** Persists the URL of a photo already uploaded via /api/upload. */
export async function updateAvatar(avatarUrl: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!avatarUrl.trim()) return { error: "No photo URL provided." };

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: { avatarUrl },
    create: { userId: user.id, avatarUrl },
  });
  await syncVerification(user.id);

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Self-service reader → author upgrade. No approval needed — anyone can
 * write; verification (a separate step) is what gates actually publishing.
 * Deliberately one-way here: stepping back to reader would orphan an
 * author's articles/wallet, so that's not offered.
 */
export async function becomeAuthor(): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "reader") {
    return { error: "Only reader accounts can switch to an author account." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "author" } });
  await syncVerification(user.id);

  // Push the new role into the live session so the JWT reflects it
  // immediately, without requiring the user to log back in.
  await updateSession({ user: { role: "author" } });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  const user = await requireUser();

  if (input.newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!record?.passwordHash) return { error: "Account not found." };

  const valid = await bcrypt.compare(input.currentPassword, record.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { ok: true };
}
