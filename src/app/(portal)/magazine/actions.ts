"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { issueOf } from "@/lib/magazine";

export type ActionResult = { error: string } | { ok: true };

async function requireEditor() {
  const session = await auth();
  if (!session?.user || !["editor", "admin"].includes(session.user.role)) {
    throw new Error("Not authorized");
  }
  return session.user;
}

/**
 * Make an article one of the issue's editor picks (slot 1-3), or remove it. A pick
 * is placed ahead of its plan's other articles, within that plan's own pages; it
 * never moves an article outside the pages its plan allows. Assigning a slot
 * already held by another article in the same month bumps that article back to
 * publish-time order.
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
    const issue = issueOf(article.publishedAt);
    await prisma.article.updateMany({
      where: {
        status: "published",
        publishedAt: { gte: issue.start, lte: issue.end },
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
