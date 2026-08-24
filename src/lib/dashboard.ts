import "server-only";

import { prisma } from "@/lib/prisma";

export interface SavedArticle {
  id: string;
  title: string;
  category: string;
  author: string;
}
export interface FollowedAuthor {
  id: string;
  name: string;
}
export interface NotificationView {
  id: string;
  type: string;
  text: string;
  createdAt: string;
}

export interface ReaderSpace {
  saved: SavedArticle[];
  followed: FollowedAuthor[];
  notifications: NotificationView[];
}

/** Everything the Reader dashboard shows, read from the database. */
export async function getReaderSpace(userId: string): Promise<ReaderSpace> {
  const [bookmarks, follows, notifications] = await Promise.all([
    prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            category: { select: { name: true } },
            author: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: { select: { id: true, displayName: true } } },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return {
    saved: bookmarks.map((b) => ({
      id: b.article.id,
      title: b.article.title,
      category: b.article.category.name,
      author: b.article.author.displayName,
    })),
    followed: follows.map((f) => ({ id: f.following.id, name: f.following.displayName })),
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      text: n.text,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export interface AuthorArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  type: string;
  views: number;
  likes: number;
  earnings: number;
}
export interface EarningsBreakdown {
  label: string;
  value: number;
}
export interface DraftArticle {
  id: string;
  title: string;
  updatedAt: string;
  status: string;
}
export interface AuthorSpace {
  articles: AuthorArticle[];
  drafts: DraftArticle[];
  totalViews: number;
  totalLikes: number;
  published: number;
  totalEarnings: number;
  earningsBreakdown: EarningsBreakdown[];
  walletBalance: number;
  rankPosition: number | null;
  rankTier: string | null;
  rankPoints: number;
}

const LEDGER_LABELS: Record<string, string> = {
  subscription: "Subscription payouts",
  read_payout: "Read-time payouts",
  ad_share: "Programmatic ad share",
  donation: "Micro-donation payouts",
  sponsorship: "Sponsorship revenue",
  report_sale: "Report sale revenue",
  affiliate: "Affiliate revenue",
};

/** The author's published portfolio + rollup stats, from the database. */
export async function getAuthorSpace(userId: string): Promise<AuthorSpace> {
  const [rows, draftRows, ledgerByType, wallet, rank] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: userId, status: "published" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        summary: true,
        contentType: true,
        viewsCount: true,
        likesCount: true,
        category: { select: { name: true } },
      },
    }),
    prisma.article.findMany({
      where: { authorId: userId, status: { in: ["draft", "changes_requested"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true, status: true },
    }),
    prisma.revenueLedger.groupBy({
      by: ["type"],
      where: {
        userId,
        type: { notIn: ["payout", "fee", "boost", "refund"] },
      },
      _sum: { net: true },
    }),
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.contributorRank.findUnique({ where: { userId } }),
  ]);

  const authorRankPosition = rank
    ? await prisma.contributorRank.count({ where: { points: { gt: rank.points } } })
    : 0;

  const articleIds = rows.map((r) => r.id);
  const articleEarnings = articleIds.length > 0
    ? await prisma.revenueLedger.groupBy({
        by: ["articleId"],
        where: {
          userId,
          articleId: { in: articleIds },
          type: { notIn: ["payout", "fee", "boost", "refund"] },
        },
        _sum: { net: true },
      })
    : [];
  const earningsMap = new Map(
    articleEarnings.map((e) => [e.articleId, Number(e._sum.net ?? 0)]),
  );

  const earningsBreakdown: EarningsBreakdown[] = ledgerByType
    .map((g) => ({
      label: LEDGER_LABELS[g.type] ?? g.type,
      value: Number(g._sum.net ?? 0),
    }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalEarnings = earningsBreakdown.reduce((s, e) => s + e.value, 0);

  return {
    articles: rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      category: r.category.name,
      type: r.contentType,
      views: r.viewsCount,
      likes: r.likesCount,
      earnings: earningsMap.get(r.id) ?? 0,
    })),
    drafts: draftRows.map((d) => ({
      id: d.id,
      title: d.title || "Untitled draft",
      updatedAt: d.updatedAt.toISOString(),
      status: d.status,
    })),
    totalViews: rows.reduce((sum, r) => sum + r.viewsCount, 0),
    totalLikes: rows.reduce((sum, r) => sum + r.likesCount, 0),
    published: rows.length,
    totalEarnings,
    earningsBreakdown,
    walletBalance: Number(wallet?.balance ?? 0),
    rankPosition: rank ? authorRankPosition + 1 : null,
    rankTier: rank?.tier ?? null,
    rankPoints: rank?.points ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Analytics Hub
// ---------------------------------------------------------------------------

export interface AnalyticsArticle {
  id: string;
  title: string;
  author: string;
  category: string;
  views: number;
  likes: number;
  earnings: number;
}
export interface CategoryShare {
  label: string;
  percent: number;
}
export interface AnalyticsData {
  totalViews: number;
  totalFollowers: number;
  totalEarnings: number;
  articles: AnalyticsArticle[];
  categoryShares: CategoryShare[];
}

/** Platform-wide analytics for the Analytics Hub, scoped to the logged-in author. */
export async function getAnalyticsData(userId: string): Promise<AnalyticsData> {
  const [articles, followerCount, ledgerTotal] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: userId, status: "published" },
      orderBy: { viewsCount: "desc" },
      select: {
        id: true,
        title: true,
        viewsCount: true,
        likesCount: true,
        author: { select: { displayName: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.revenueLedger.aggregate({
      where: {
        userId,
        type: { notIn: ["payout", "fee", "boost", "refund"] },
      },
      _sum: { net: true },
    }),
  ]);

  const articleIds = articles.map((a) => a.id);
  const articleEarnings = articleIds.length > 0
    ? await prisma.revenueLedger.groupBy({
        by: ["articleId"],
        where: {
          userId,
          articleId: { in: articleIds },
          type: { notIn: ["payout", "fee", "boost", "refund"] },
        },
        _sum: { net: true },
      })
    : [];
  const earningsMap = new Map(
    articleEarnings.map((e) => [e.articleId, Number(e._sum.net ?? 0)]),
  );

  const totalViews = articles.reduce((s, a) => s + a.viewsCount, 0);

  const catCounts = new Map<string, number>();
  for (const a of articles) {
    catCounts.set(a.category.name, (catCounts.get(a.category.name) ?? 0) + a.viewsCount);
  }
  const categoryShares: CategoryShare[] = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, views]) => ({
      label,
      percent: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0,
    }));

  return {
    totalViews,
    totalFollowers: followerCount,
    totalEarnings: Number(ledgerTotal._sum.net ?? 0),
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      author: a.author.displayName,
      category: a.category.name,
      views: a.viewsCount,
      likes: a.likesCount,
      earnings: earningsMap.get(a.id) ?? 0,
    })),
    categoryShares,
  };
}
