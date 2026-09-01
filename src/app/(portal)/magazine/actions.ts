"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isoWeekOf } from "@/lib/magazine";

export type ActionResult = { error: string } | { ok: true };

async function requireEditor() {
  const session = await auth();
  if (!session?.user || !["editor", "admin"].includes(session.user.role)) {
    throw new Error("Not authorized");
  }
  return session.user;
}

/**
 * Feature (or unfeature) an article into one of the issue's first 3 pages.
 * Assigning a slot already held by another article in the same week bumps
 * that article back into the regular, publish-time-ordered pages.
 */
export async function setMagazineFeature(articleId: string, order: 1 | 2 | 3 | null): Promise<ActionResult> {
  await requireEditor();

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { status: true, publishedAt: true },
  });
  if (!article) return { error: "Article not found." };
  if (article.status !== "published" || !article.publishedAt) {
    return { error: "Only published articles can be featured in the magazine." };
  }

  if (order !== null) {
    const issue = isoWeekOf(article.publishedAt);
    await prisma.article.updateMany({
      where: {
        status: "published",
        publishedAt: { gte: issue.weekStart, lte: issue.weekEnd },
        magazineFeatureOrder: order,
        id: { not: articleId },
      },
      data: { magazineFeatured: false, magazineFeatureOrder: null },
    });
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { magazineFeatured: order !== null, magazineFeatureOrder: order },
  });

  revalidatePath("/magazine");
  return { ok: true };
}
