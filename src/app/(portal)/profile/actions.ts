"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ABN_COUNTRY } from "@/lib/platformConfig";

export type ActionResult = { error: string } | { ok: true };

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
}): Promise<ActionResult> {
  const user = await requireUser();

  const displayName = input.displayName.trim();
  if (!displayName) return { error: "Display name can't be empty." };

  const country = input.country.trim();
  const abn = country === ABN_COUNTRY ? input.abn.trim() || null : null;

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

  revalidatePath("/profile", "layout");
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
