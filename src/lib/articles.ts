import "server-only";

import { prisma } from "@/lib/prisma";
import type { FeedArticle } from "@/lib/types";

/** Read the minutes-to-read we stored on the article's aiScores blob. */
function readTimeOf(aiScores: unknown): string {
  const min =
    aiScores && typeof aiScores === "object" && "readTimeMin" in aiScores
      ? Number((aiScores as { readTimeMin: unknown }).readTimeMin)
      : NaN;
  return `${Number.isFinite(min) && min > 0 ? min : 5} min read`;
}

/**
 * Published, publicly-visible articles for the Explore feed, newest first.
 * Content is intentionally not selected — the feed only needs summaries.
 */
export async function listPublishedArticles(): Promise<FeedArticle[]> {
  const rows = await prisma.article.findMany({
    where: { status: "published", lane: { in: ["public", "hybrid"] } },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      contentType: true,
      verified: true,
      likesCount: true,
      aiScores: true,
      category: { select: { name: true } },
      author: { select: { displayName: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category.name,
    type: row.contentType,
    author: row.author.displayName,
    verified: row.verified,
    likes: row.likesCount,
    readTime: readTimeOf(row.aiScores),
  }));
}
