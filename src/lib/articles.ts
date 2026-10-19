import "server-only";

import { priorityAuthorIds } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { cleanSeo, type SeoMetadata } from "@/lib/seoMetadata";
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
      author: { select: { displayName: true, isVerified: true } },
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
    authorVerified: row.author.isVerified,
    likes: row.likesCount,
    readTime: readTimeOf(row.aiScores),
  }));
}

const TIER_LABEL: Record<string, string> = {
  bronze: "Bronze Contributor",
  silver: "Silver Contributor",
  gold: "Gold Contributor",
};

export interface ReviewQueueItem {
  id: string;
  title: string;
  author: string;
  authorRank: string;
  authorVerified: boolean;
  license: string;
  category: string;
  type: string;
  /** ISO timestamp (UTC); formatted to the viewer's local time in the client. */
  submittedAt: string;
  aiScore: number;
  plagiarism: string;
  readability: string;
  sentiment: string;
  content: string;
  /** Author's chosen destination — gates whether "Approve & Publish" applies. */
  destination: "main_app" | "exchange_hub";
  /** The author's plan includes priority editorial review: shown first in the queue. */
  priority: boolean;
}

function scoreField(aiScores: unknown, key: string, fallback: string | number) {
  if (aiScores && typeof aiScores === "object" && key in aiScores) {
    return (aiScores as Record<string, unknown>)[key] as string | number;
  }
  return fallback;
}

/**
 * Articles awaiting editorial review (status = in_review), newest first.
 * Excludes company-authored articles — those are reviewed by their own
 * company's editor sub-account (see listCompanyReviewQueue in
 * src/app/(portal)/company/actions.ts), never by platform staff.
 */
export async function listReviewQueue(): Promise<ReviewQueueItem[]> {
  const rows = await prisma.article.findMany({
    where: { status: "in_review", author: { role: { not: "corporate" } } },
    orderBy: { createdAt: "asc" },
    include: {
      category: { select: { name: true } },
      author: { select: { displayName: true, isVerified: true, rank: { select: { tier: true } } } },
    },
  });

  // Priority review (Professional and above) goes to the front; within each
  // group the oldest submission is first. The sort is stable, so ties keep order.
  const priorityIds = await priorityAuthorIds(rows.map((r) => r.authorId));
  const waiting = (r: (typeof rows)[number]) => (r.submittedAt ?? r.createdAt).getTime();
  const ordered = [...rows].sort((a, b) => {
    const pa = priorityIds.has(a.authorId) ? 0 : 1;
    const pb = priorityIds.has(b.authorId) ? 0 : 1;
    return pa - pb || waiting(a) - waiting(b);
  });

  return ordered.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author.displayName,
    authorRank: TIER_LABEL[row.author.rank?.tier ?? "bronze"] ?? "Contributor",
    authorVerified: row.author.isVerified,
    license: row.license,
    category: row.category.name,
    type: row.contentType,
    submittedAt: (row.submittedAt ?? row.createdAt).toISOString(),
    priority: priorityIds.has(row.authorId),
    aiScore: Number(scoreField(row.aiScores, "aiScore", 90)),
    plagiarism: String(scoreField(row.aiScores, "plagiarism", "0.4% detected")),
    readability: String(scoreField(row.aiScores, "readability", "Good (Flesch: 65)")),
    sentiment: String(scoreField(row.aiScores, "sentiment", "Analytical")),
    content: row.content,
    destination: row.destination,
  }));
}

export interface ArticleComment {
  id: string;
  author: string;
  verified: boolean;
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
  authorId: string;
  authorRank: string;
  authorVerified: boolean;
  license: string;
  followerCount: number;
  isOwnArticle: boolean;
  followingAuthor: boolean;
  likes: number;
  liked: boolean;
  bookmarked: boolean;
  shares: number;
  comments: ArticleComment[];
  /** Search title / description / keywords the author saved on submit, if any. */
  seo: SeoMetadata | null;
}

/** The search metadata saved in an article's aiScores blob, if any. */
function readSeo(aiScores: unknown): SeoMetadata | null {
  if (!aiScores || typeof aiScores !== "object" || !("seo" in aiScores)) return null;
  const seo = cleanSeo((aiScores as { seo: Record<string, unknown> }).seo ?? {});
  return seo.title || seo.description || seo.keywords.length > 0 ? seo : null;
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
      author: { select: { id: true, displayName: true, isVerified: true, rank: { select: { tier: true } } } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { displayName: true, role: true, isVerified: true } } },
      },
      likes: userId ? { where: { userId }, select: { userId: true } } : false,
      bookmarks: userId ? { where: { userId }, select: { userId: true } } : false,
    },
  });
  if (!row) return null;

  const [followingAuthor, followerCount] = await Promise.all([
    userId && userId !== row.author.id
      ? prisma.follow.count({ where: { followerId: userId, followingId: row.author.id } }).then((n) => n > 0)
      : Promise.resolve(false),
    prisma.follow.count({ where: { followingId: row.author.id } }),
  ]);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category.name,
    content: row.content,
    author: row.author.displayName,
    authorId: row.author.id,
    authorRank: TIER_LABEL[row.author.rank?.tier ?? "bronze"] ?? "Contributor",
    authorVerified: row.author.isVerified,
    license: row.license,
    followerCount,
    isOwnArticle: userId === row.author.id,
    followingAuthor,
    likes: row.likesCount,
    liked: Array.isArray(row.likes) && row.likes.length > 0,
    bookmarked: Array.isArray(row.bookmarks) && row.bookmarks.length > 0,
    shares: row.sharesCount,
    comments: row.comments.map((comment) => ({
      id: comment.id,
      author: `${comment.user.displayName} (${comment.user.role.toUpperCase()})`,
      verified: comment.user.isVerified,
      text: comment.text,
      date: comment.createdAt.toISOString().slice(0, 10),
    })),
    seo: readSeo(row.aiScores),
  };
}
