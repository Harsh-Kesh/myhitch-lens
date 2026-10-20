import "server-only";

import { prisma } from "@/lib/prisma";
import { ABN_COUNTRY } from "@/lib/platformConfig";
import { lookupAbn, normalizeAbn } from "@/lib/abn";
import { syncVerification } from "@/lib/verification";

/**
 * My Profile edits, shared by the website (src/app/(portal)/profile/actions.ts)
 * and the MYHitch app (through the hub). Callers decide who [userId] is.
 */

export type ProfileUpdateResult = { error: string } | { ok: true; abnEntityName?: string };

export interface ProfileInput {
  displayName: string;
  bio: string;
  website: string;
  country: string;
  abn: string;
}

export async function updateProfileFor(userId: string, input: ProfileInput): Promise<ProfileUpdateResult> {
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
    prisma.user.update({ where: { id: userId }, data: { displayName } }),
    prisma.profile.upsert({
      where: { userId },
      update: {
        bio: input.bio.trim() || null,
        website: input.website.trim() || null,
        country: country || null,
        abn,
      },
      create: {
        userId,
        bio: input.bio.trim() || null,
        website: input.website.trim() || null,
        country: country || null,
        abn,
      },
    }),
  ]);
  await syncVerification(userId);
  return { ok: true, abnEntityName };
}

/** Saves the URL of a photo already uploaded (see storeUpload in src/lib/mediaUpload.ts). */
export async function setAvatarFor(userId: string, avatarUrl: string): Promise<{ error: string } | { ok: true }> {
  if (!avatarUrl.trim()) return { error: "No photo URL provided." };

  await prisma.profile.upsert({
    where: { userId },
    update: { avatarUrl },
    create: { userId, avatarUrl },
  });
  await syncVerification(userId);
  return { ok: true };
}
