import "server-only";

import { prisma } from "@/lib/prisma";
import type { ContributorTier } from "@prisma/client";

/**
 * Contributor ranking — per the boss's rule: likes, comments, and shares are
 * the base signal (weighted so an active comment/share counts for more than a
 * passive like); when two authors are close on those, sponsorship activity
 * (Exchange Hub deals won, and their value) should decisively push one ahead.
 * All weights below are tunable constants, not fixed business logic.
 */
const WEIGHTS = {
  like: 1,
  comment: 3,
  share: 5,
} as const;

const SPONSORSHIP = {
  perDeal: 50,
  perDollarRevenue: 0.5,
} as const;

/** Checked in order — first threshold the points clear (from the top) wins. */
const TIER_THRESHOLDS: { tier: ContributorTier; min: number }[] = [
  { tier: "gold", min: 800 },
  { tier: "silver", min: 200 },
  { tier: "bronze", min: 0 },
];

function tierForPoints(points: number): ContributorTier {
  return TIER_THRESHOLDS.find((t) => points >= t.min)!.tier;
}

export interface ContributorScoreBreakdown {
  points: number;
  tier: ContributorTier;
  likes: number;
  comments: number;
  shares: number;
  sponsorshipDeals: number;
  sponsorshipRevenue: number;
}

/** Recomputes an author's score live from their real activity — nothing here is cached. */
export async function computeContributorScore(userId: string): Promise<ContributorScoreBreakdown> {
  const articles = await prisma.article.findMany({
    where: { authorId: userId, status: "published" },
    select: { id: true, likesCount: true, sharesCount: true },
  });
  const articleIds = articles.map((a) => a.id);
  const likes = articles.reduce((sum, a) => sum + a.likesCount, 0);
  const shares = articles.reduce((sum, a) => sum + a.sharesCount, 0);

  const [comments, sponsorship] = await Promise.all([
    articleIds.length > 0
      ? prisma.comment.count({ where: { articleId: { in: articleIds } } })
      : Promise.resolve(0),
    prisma.revenueLedger.aggregate({
      where: { userId, type: "sponsorship" },
      _sum: { gross: true },
      _count: true,
    }),
  ]);

  const sponsorshipDeals = sponsorship._count;
  const sponsorshipRevenue = Number(sponsorship._sum.gross ?? 0);

  const base = likes * WEIGHTS.like + comments * WEIGHTS.comment + shares * WEIGHTS.share;
  const sponsorshipBonus = sponsorshipDeals * SPONSORSHIP.perDeal + sponsorshipRevenue * SPONSORSHIP.perDollarRevenue;
  const points = Math.round(base + sponsorshipBonus);

  return { points, tier: tierForPoints(points), likes, comments, shares, sponsorshipDeals, sponsorshipRevenue };
}

/**
 * Recomputes and persists an author's ContributorRank — call after any
 * activity that could move the number (a like/unlike, a comment, a share, or
 * a sponsorship deal resolving). Every user already has a ContributorRank row
 * from signup, so this is always an update, never a first-time create — the
 * upsert is just defense-in-depth.
 */
export async function syncContributorRank(userId: string): Promise<void> {
  const { points, tier } = await computeContributorScore(userId);
  await prisma.contributorRank.upsert({
    where: { userId },
    update: { points, tier },
    create: { userId, points, tier },
  });
}
