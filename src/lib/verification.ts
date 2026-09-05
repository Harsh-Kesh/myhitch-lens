import "server-only";

import { prisma } from "@/lib/prisma";
import { isValidAbnChecksum } from "@/lib/abn";
import { ABN_COUNTRY } from "@/lib/platformConfig";

/**
 * Verification is fully automatic — no application, no editor review. An
 * author is verified the moment their profile satisfies every checklist item
 * below, and loses the badge the moment it no longer does. syncVerification()
 * recomputes and persists this; call it after any write that could change the
 * answer (profile edits, avatar upload, becoming an author).
 */

export interface VerificationChecklistItem {
  key: string;
  label: string;
  met: boolean;
}

export interface VerificationChecklist {
  items: VerificationChecklistItem[];
  eligible: boolean;
}

const MIN_BIO_LENGTH = 20;

async function buildChecklist(userId: string): Promise<VerificationChecklist> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      profile: { select: { bio: true, avatarUrl: true, country: true, abn: true } },
    },
  });
  const profile = user?.profile;

  const bioOk = Boolean(profile?.bio && profile.bio.trim().length >= MIN_BIO_LENGTH);
  const photoOk = Boolean(profile?.avatarUrl);
  const countryOk = Boolean(profile?.country);

  const items: VerificationChecklistItem[] = [
    { key: "bio", label: `Write a short author bio (${MIN_BIO_LENGTH}+ characters)`, met: bioOk },
    { key: "photo", label: "Upload a profile photo", met: photoOk },
    { key: "country", label: "Set your country", met: countryOk },
  ];

  // Only meaningful once we know the author is in a country with a tax-id
  // field at all — otherwise there's nothing to check.
  if (profile?.country === ABN_COUNTRY) {
    items.push({
      key: "abn",
      label: "Provide a valid ABN",
      met: Boolean(profile.abn && isValidAbnChecksum(profile.abn)),
    });
  }

  return { items, eligible: items.every((i) => i.met) };
}

/** Recomputes verification from the live checklist and persists any change. */
export async function syncVerification(userId: string): Promise<boolean> {
  const [{ eligible }, user] = await Promise.all([
    buildChecklist(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { isVerified: true } }),
  ]);

  if (eligible !== (user?.isVerified ?? false)) {
    await prisma.user.update({ where: { id: userId }, data: { isVerified: eligible } });
    if (eligible) {
      await prisma.notification.create({
        data: {
          userId,
          type: "verification",
          text: "You're now verified — your blue mark is live across the platform.",
        },
      });
    }
  }

  return eligible;
}

/** Checklist + current status, for the author dashboard. */
export async function getMyVerification(userId: string): Promise<VerificationChecklist & { isVerified: boolean }> {
  const [checklist, user] = await Promise.all([
    buildChecklist(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { isVerified: true } }),
  ]);
  return { ...checklist, isVerified: user?.isVerified ?? false };
}

/** Whether an author is currently allowed to submit — the actual gate. */
export async function isEligibleToSubmit(userId: string): Promise<{ eligible: boolean; missing: string[] }> {
  const { items, eligible } = await buildChecklist(userId);
  return { eligible, missing: items.filter((i) => !i.met).map((i) => i.label) };
}
