import "server-only";

import { prisma } from "@/lib/prisma";
import { syncContributorRank } from "@/lib/ranking";

/**
 * Counting reads and shares, for the website's article page and the MYHitch
 * app (through the hub). [viewerId] is the Lens user reading, or null for
 * someone not signed in to Lens (every app reader). The author's own reads
 * and shares don't count, so metrics stay honest.
 */

export async function countArticleView(articleId: string, viewerId: string | null): Promise<boolean> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, status: true },
  });
  if (!article || article.status !== "published") return false;
  if (viewerId && viewerId === article.authorId) return false;

  await prisma.$transaction([
    prisma.article.update({ where: { id: articleId }, data: { viewsCount: { increment: 1 } } }),
    prisma.analyticsEvent.create({ data: { articleId, userId: viewerId, kind: "view" } }),
  ]);
  return true;
}

/** A share also counts toward the author's contributor ranking. */
export async function countArticleShare(articleId: string, viewerId: string | null): Promise<boolean> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, status: true },
  });
  if (!article || article.status !== "published") return false;
  if (viewerId && viewerId === article.authorId) return false;

  await prisma.$transaction([
    prisma.article.update({ where: { id: articleId }, data: { sharesCount: { increment: 1 } } }),
    prisma.analyticsEvent.create({ data: { articleId, userId: viewerId, kind: "share" } }),
  ]);
  await syncContributorRank(article.authorId);
  return true;
}
