"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Remove a bookmark for the current user. */
export async function removeBookmark(articleId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  await prisma.bookmark
    .delete({ where: { userId_articleId: { userId: session.user.id, articleId } } })
    .catch(() => {});
  revalidatePath("/reader-dashboard");
}

/** Unfollow an author. */
export async function unfollowAuthor(authorId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  await prisma.follow
    .delete({
      where: { followerId_followingId: { followerId: session.user.id, followingId: authorId } },
    })
    .catch(() => {});
  revalidatePath("/reader-dashboard");
}
