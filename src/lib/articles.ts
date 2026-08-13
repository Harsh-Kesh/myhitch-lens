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

const TIER_LABEL: Record<string, string> = {
  bronze: "Bronze Contributor",
  silver: "Silver Contributor",
  gold: "Gold Contributor",
};

export interface ArticleComment {
  id: string;
  author: string;
  text: string;
  date: string;
}

export interface ArticleDetail {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  author: string;
  authorRank: string;
  likes: number;
  liked: boolean;
  bookmarked: boolean;
  comments: ArticleComment[];
}

/** Full article for the reader page, with the current user's like/bookmark state. */
export async function getArticle(
  idOrSlug: string,
  userId?: string,
): Promise<ArticleDetail | null> {
  const row = await prisma.article.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      category: { select: { name: true } },
      author: { select: { displayName: true, rank: { select: { tier: true } } } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { displayName: true, role: true } } },
      },
      likes: userId ? { where: { userId }, select: { userId: true } } : false,
      bookmarks: userId ? { where: { userId }, select: { userId: true } } : false,
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category.name,
    content: row.content,
    author: row.author.displayName,
    authorRank: TIER_LABEL[row.author.rank?.tier ?? "bronze"] ?? "Contributor",
    likes: row.likesCount,
    liked: Array.isArray(row.likes) && row.likes.length > 0,
    bookmarked: Array.isArray(row.bookmarks) && row.bookmarks.length > 0,
    comments: row.comments.map((comment) => ({
      id: comment.id,
      author: `${comment.user.displayName} (${comment.user.role.toUpperCase()})`,
      text: comment.text,
      date: comment.createdAt.toISOString().slice(0, 10),
    })),
  };
}
