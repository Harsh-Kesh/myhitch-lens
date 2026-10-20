"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { setAvatarFor, updateProfileFor, type ProfileUpdateResult as UpdateResult } from "@/lib/profile";

export type ActionResult = { error: string } | { ok: true };
export type ProfileUpdateResult = UpdateResult;

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
  const result = await updateProfileFor(user.id, input);
  if ("error" in result) return result;

  revalidatePath("/profile", "layout");
  return result;
}

/** Persists the URL of a photo already uploaded via /api/upload. */
export async function updateAvatar(avatarUrl: string): Promise<ActionResult> {
  const user = await requireUser();
  const result = await setAvatarFor(user.id, avatarUrl);
  if ("error" in result) return result;

  revalidatePath("/", "layout");
  return { ok: true };
}
