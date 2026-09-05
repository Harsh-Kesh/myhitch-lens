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
  verified: boolean;
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
      include: { following: { select: { id: true, displayName: true, isVerified: true } } },
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
    followed: follows.map((f) => ({ id: f.following.id, name: f.following.displayName, verified: f.following.isVerified })),
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
export interface PendingReviewArticle {
  id: string;
  title: string;
  submittedAt: string;
}
export interface RemovedArticle {
  id: string;
  title: string;
  /** Which appeal mechanism applies: a copyright counter-notice, or a general editorial appeal. */
  kind: "copyright" | "editorial";
  /** The ticket already filed for this removal — null for "editorial" until the author files one. */
  ticketId: string | null;
  reason: string;
  removedAt: string;
  // copyright: none | pending | upheld | denied (DisputeTicket.appealStatus)
  // editorial: none | open | under_review | resolved | rejected (DisputeTicket.status)
  appealStatus: string;
  appealText: string | null;
}

export interface AuthorSpace {
  articles: AuthorArticle[];
  drafts: DraftArticle[];
  pendingReview: PendingReviewArticle[];
  removedArticles: RemovedArticle[];
  copyrightStrikes: number;
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
  report_sale: "Ownership & report sales",
  affiliate: "Affiliate revenue",
};

/** The author's published portfolio + rollup stats, from the database. */
export async function getAuthorSpace(userId: string): Promise<AuthorSpace> {
  const [rows, draftRows, pendingReviewRows, rejectedRows, ledgerByType, wallet, rank, user] = await Promise.all([
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
    prisma.article.findMany({
      where: { authorId: userId, status: "in_review" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.article.findMany({
      where: { authorId: userId, status: "rejected" },
      select: { id: true, title: true, updatedAt: true },
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
    prisma.user.findUnique({ where: { id: userId }, select: { copyrightStrikes: true } }),
  ]);

  // Every rejection is one of two kinds: a resolved copyright takedown (its
  // own counter-notice flow via appealTakedown), or a plain editorial call —
  // handled by the general fileEditorialAppeal flow instead. Batched into
  // one query per ticket type instead of one round-trip per article.
  const rejectedIds = rejectedRows.map((r) => r.id);
  const subjectMatchesAny = rejectedIds.map((id) => ({ subject: { startsWith: `${id} — ` } }));
  const [copyrightTickets, editorialTickets, revisions] = rejectedIds.length
    ? await Promise.all([
        prisma.disputeTicket.findMany({
          where: { OR: subjectMatchesAny, reason: "copyright", status: "resolved" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.disputeTicket.findMany({
          where: { OR: subjectMatchesAny, reason: { in: ["plagiarism", "category", "editorial", "other"] } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.revision.findMany({ where: { articleId: { in: rejectedIds } }, orderBy: { createdAt: "desc" } }),
      ])
    : [[], [], []];

  // Each list is ordered newest-first, so keeping only the first entry per
  // article id yields the most recent one — same result as the old findFirst-per-row loop.
  const articleIdFromSubject = (subject: string) => subject.split(" — ")[0];
  const latestByArticle = <T extends { articleId?: string; subject?: string }>(rows: T[], keyOf: (r: T) => string) => {
    const map = new Map<string, T>();
    for (const row of rows) {
      const key = keyOf(row);
      if (!map.has(key)) map.set(key, row);
    }
    return map;
  };
  const copyrightByArticle = latestByArticle(copyrightTickets, (t) => articleIdFromSubject(t.subject));
  const editorialByArticle = latestByArticle(editorialTickets, (t) => articleIdFromSubject(t.subject));
  const revisionByArticle = latestByArticle(revisions, (r) => r.articleId);

  const removedArticles: RemovedArticle[] = rejectedRows.map((r) => {
    const copyrightTicket = copyrightByArticle.get(r.id);
    if (copyrightTicket) {
      return {
        id: r.id,
        title: r.title,
        kind: "copyright",
        ticketId: copyrightTicket.id,
        reason: copyrightTicket.justify,
        removedAt: copyrightTicket.createdAt.toISOString(),
        appealStatus: copyrightTicket.appealStatus,
        appealText: copyrightTicket.appealText,
      };
    }

    const lastRevision = revisionByArticle.get(r.id);
    const editorialTicket = editorialByArticle.get(r.id);
    return {
      id: r.id,
      title: r.title,
      kind: "editorial",
      ticketId: editorialTicket?.id ?? null,
      reason: lastRevision?.note || "No reason recorded.",
      removedAt: (lastRevision?.createdAt ?? r.updatedAt).toISOString(),
      appealStatus: editorialTicket?.status ?? "none",
      appealText: editorialTicket?.justify ?? null,
    };
  });

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
    removedArticles,
    copyrightStrikes: user?.copyrightStrikes ?? 0,
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
    pendingReview: pendingReviewRows.map((p) => ({
      id: p.id,
      title: p.title || "Untitled",
      submittedAt: p.updatedAt.toISOString(),
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

// ---------------------------------------------------------------------------
// Platform-wide analytics (editor/admin view of the Analytics Hub)
// ---------------------------------------------------------------------------

export interface TopAuthorRow {
  id: string;
  name: string;
  articles: number;
  views: number;
  earnings: number;
}
export interface PlatformAnalyticsData {
  totalViews: number;
  totalArticles: number;
  totalAuthors: number;
  totalEarnings: number;
  topArticles: AnalyticsArticle[];
  topAuthors: TopAuthorRow[];
  categoryShares: CategoryShare[];
}

/** Rough, platform-wide view across every author's published work — editor/admin only. */
export async function getPlatformAnalytics(): Promise<PlatformAnalyticsData> {
  const [articles, ledgerTotal] = await Promise.all([
    prisma.article.findMany({
      where: { status: "published" },
      orderBy: { viewsCount: "desc" },
      select: {
        id: true,
        title: true,
        viewsCount: true,
        likesCount: true,
        authorId: true,
        author: { select: { displayName: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.revenueLedger.aggregate({
      where: { type: { notIn: ["payout", "fee", "boost", "refund"] } },
      _sum: { net: true },
    }),
  ]);

  const articleIds = articles.map((a) => a.id);
  const articleEarnings = articleIds.length > 0
    ? await prisma.revenueLedger.groupBy({
        by: ["articleId"],
        where: { articleId: { in: articleIds }, type: { notIn: ["payout", "fee", "boost", "refund"] } },
        _sum: { net: true },
      })
    : [];
  const earningsByArticle = new Map(articleEarnings.map((e) => [e.articleId, Number(e._sum.net ?? 0)]));

  const authorIds = [...new Set(articles.map((a) => a.authorId))];
  const authorEarnings = authorIds.length > 0
    ? await prisma.revenueLedger.groupBy({
        by: ["userId"],
        where: { userId: { in: authorIds }, type: { notIn: ["payout", "fee", "boost", "refund"] } },
        _sum: { net: true },
      })
    : [];
  const earningsByAuthor = new Map(authorEarnings.map((e) => [e.userId, Number(e._sum.net ?? 0)]));

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

  const authorAgg = new Map<string, { name: string; articles: number; views: number }>();
  for (const a of articles) {
    const entry = authorAgg.get(a.authorId) ?? { name: a.author.displayName, articles: 0, views: 0 };
    entry.articles += 1;
    entry.views += a.viewsCount;
    authorAgg.set(a.authorId, entry);
  }
  const topAuthors: TopAuthorRow[] = [...authorAgg.entries()]
    .map(([id, v]) => ({ id, name: v.name, articles: v.articles, views: v.views, earnings: earningsByAuthor.get(id) ?? 0 }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return {
    totalViews,
    totalArticles: articles.length,
    totalAuthors: authorAgg.size,
    totalEarnings: Number(ledgerTotal._sum.net ?? 0),
    // Capped — a platform-wide table has no natural "it's just my own work" limit.
    topArticles: articles.slice(0, 25).map((a) => ({
      id: a.id,
      title: a.title,
      author: a.author.displayName,
      category: a.category.name,
      views: a.viewsCount,
      likes: a.likesCount,
      earnings: earningsByArticle.get(a.id) ?? 0,
    })),
    topAuthors,
    categoryShares,
  };
}

// ---------------------------------------------------------------------------
// Per-article analytics
// ---------------------------------------------------------------------------

const REVENUE_LABELS: Record<string, string> = {
  subscription: "Subscriptions",
  read_payout: "Read-time payouts",
  ad_share: "Programmatic ads",
  donation: "Donations",
  sponsorship: "Sponsorship",
  report_sale: "Ownership & report sales",
  affiliate: "Affiliate",
};

export interface ArticleAnalytics {
  id: string;
  title: string;
  authorId: string;
  author: string;
  authorVerified: boolean;
  category: string;
  type: string;
  status: string;
  lane: string;
  publishedAt: string | null;
  readTimeMin: number;
  views: number;
  likes: number;
  comments: number;
  bookmarks: number;
  engagementRate: number; // (likes + comments + bookmarks) / views, %
  revenueByType: { label: string; value: number }[];
  totalRevenue: number;
  owner: string | null;
  soldPrice: number | null;
  viewTrend: { date: string; views: number }[]; // last 14 days
}

/** Deep analytics for a single article. Access is enforced by the caller. */
export async function getArticleAnalytics(articleId: string): Promise<ArticleAnalytics | null> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      authorId: true,
      contentType: true,
      status: true,
      lane: true,
      publishedAt: true,
      viewsCount: true,
      likesCount: true,
      aiScores: true,
      author: { select: { displayName: true, isVerified: true } },
      owner: { select: { displayName: true } },
      category: { select: { name: true } },
      _count: { select: { comments: true, bookmarks: true } },
    },
  });
  if (!article) return null;

  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [revenue, viewEvents] = await Promise.all([
    prisma.revenueLedger.groupBy({
      by: ["type"],
      where: { articleId, type: { notIn: ["payout", "fee", "boost", "refund"] } },
      _sum: { net: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { articleId, kind: "view", createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const revenueByType = revenue
    .map((r) => ({ label: REVENUE_LABELS[r.type] ?? r.type, value: Number(r._sum.net ?? 0) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const totalRevenue = revenueByType.reduce((s, r) => s + r.value, 0);

  // Bucket view events into the last 14 calendar days.
  const dayCounts = new Map<string, number>();
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    dayCounts.set(d.toISOString().slice(0, 10), 0);
  }
  for (const ev of viewEvents) {
    const key = ev.createdAt.toISOString().slice(0, 10);
    if (dayCounts.has(key)) dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }
  const viewTrend = [...dayCounts.entries()].map(([date, views]) => ({ date, views }));

  const scores = (article.aiScores ?? {}) as { readTimeMin?: number };
  const views = article.viewsCount;
  const engagements = article.likesCount + article._count.comments + article._count.bookmarks;

  return {
    id: article.id,
    title: article.title,
    authorId: article.authorId,
    author: article.author.displayName,
    authorVerified: article.author.isVerified,
    category: article.category.name,
    type: article.contentType,
    status: article.status,
    lane: article.lane,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    readTimeMin: Number(scores.readTimeMin ?? 5),
    views,
    likes: article.likesCount,
    comments: article._count.comments,
    bookmarks: article._count.bookmarks,
    engagementRate: views > 0 ? Math.round((engagements / views) * 1000) / 10 : 0,
    revenueByType,
    totalRevenue,
    owner: article.owner?.displayName ?? null,
    soldPrice: null,
    viewTrend,
  };
}
