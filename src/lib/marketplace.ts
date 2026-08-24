import "server-only";

import { prisma } from "@/lib/prisma";
import { MARKETPLACE_DEFAULTS, PLATFORM_FEES, type PlatformFeeType } from "@/lib/platformConfig";

// ---------------------------------------------------------------------------
// Money / auction helpers
// ---------------------------------------------------------------------------

/** Platform fee (AUD) for a gross amount of a given revenue type. */
export function feeFor(type: PlatformFeeType, gross: number): number {
  return round2(gross * PLATFORM_FEES[type]);
}

/**
 * Second-price (Vickrey) settlement: the winner pays one increment above the
 * runner-up, capped at their own bid; a lone bidder pays the floor. Returns the
 * price the winner actually pays.
 */
export function settlementPrice(
  bidAmountsDesc: number[],
  floorPrice: number,
  increment: number = MARKETPLACE_DEFAULTS.bidIncrement,
): number {
  if (bidAmountsDesc.length === 0) return 0;
  const top = bidAmountsDesc[0];
  if (bidAmountsDesc.length === 1) return round2(Math.max(floorPrice, floorPrice));
  const second = bidAmountsDesc[1];
  return round2(Math.min(top, second + increment));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface PanelListing {
  listingId: string;
  auctionId: string;
  articleId: string;
  title: string;
  summary: string;
  category: string;
  author: string;
  authorId: string;
  floorPrice: number;
  reservePrice: number | null;
  allowedCategories: string[];
  endsAt: string;
  status: string;
  bidCount: number;
  topBid: number;
  minNextBid: number;
  /** True when the viewer is the article's author (can't bid on own work). */
  isOwn: boolean;
  /** The viewer's current highest active bid on this auction, if any. */
  myBid: number | null;
}

/** Open sponsorship auctions available to bid on, newest first. */
export async function listOpenPanelListings(viewerId?: string): Promise<PanelListing[]> {
  const auctions = await prisma.auction.findMany({
    where: { type: "sponsorship", status: "open" },
    orderBy: { createdAt: "desc" },
    include: {
      listing: {
        include: {
          article: {
            select: {
              id: true,
              title: true,
              summary: true,
              category: { select: { name: true } },
              author: { select: { id: true, displayName: true } },
            },
          },
        },
      },
      bids: {
        where: { status: { in: ["active", "won"] } },
        orderBy: { amount: "desc" },
        select: { amount: true, bidderId: true },
      },
    },
  });

  return auctions
    .filter((a) => a.listing?.article)
    .map((a) => {
      const listing = a.listing!;
      const article = listing.article;
      const amounts = a.bids.map((b) => Number(b.amount));
      const topBid = amounts.length ? amounts[0] : 0;
      const floor = Number(listing.floorPrice);
      const minNextBid = topBid > 0 ? round2(topBid + MARKETPLACE_DEFAULTS.bidIncrement) : floor;
      const myBids = viewerId ? a.bids.filter((b) => b.bidderId === viewerId).map((b) => Number(b.amount)) : [];
      return {
        listingId: listing.id,
        auctionId: a.id,
        articleId: article.id,
        title: article.title,
        summary: article.summary,
        category: article.category.name,
        author: article.author.displayName,
        authorId: article.author.id,
        floorPrice: floor,
        reservePrice: listing.reservePrice != null ? Number(listing.reservePrice) : null,
        allowedCategories: listing.allowedCategories,
        endsAt: a.endsAt.toISOString(),
        status: a.status,
        bidCount: a.bids.length,
        topBid,
        minNextBid,
        isOwn: viewerId === article.author.id,
        myBid: myBids.length ? Math.max(...myBids) : null,
      };
    });
}

export interface ListingBid {
  bidId: string;
  bidder: string;
  bidderId: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface AuthorListing extends PanelListing {
  bids: ListingBid[];
  settlementPreview: number;
  placement: {
    id: string;
    brandName: string;
    tagline: string | null;
    status: string;
    liveFrom: string | null;
    liveUntil: string | null;
    amount: number | null;
  } | null;
}

/** All of an author's sponsorship auctions (any status) with their bids + placement. */
export async function listAuthorListings(authorId: string): Promise<AuthorListing[]> {
  const auctions = await prisma.auction.findMany({
    where: { type: "sponsorship", listing: { article: { authorId } } },
    orderBy: { createdAt: "desc" },
    include: {
      listing: {
        include: {
          article: {
            select: {
              id: true,
              title: true,
              summary: true,
              category: { select: { name: true } },
              author: { select: { id: true, displayName: true } },
            },
          },
        },
      },
      bids: {
        orderBy: { amount: "desc" },
        include: { bidder: { select: { displayName: true } } },
      },
      placement: true,
    },
  });

  return auctions
    .filter((a) => a.listing?.article)
    .map((a) => {
      const listing = a.listing!;
      const article = listing.article;
      const activeAmounts = a.bids
        .filter((b) => b.status === "active" || b.status === "won")
        .map((b) => Number(b.amount))
        .sort((x, y) => y - x);
      const topBid = activeAmounts.length ? activeAmounts[0] : 0;
      const floor = Number(listing.floorPrice);
      const creative = (a.placement?.creativeAsset ?? {}) as { brandName?: string; tagline?: string };
      return {
        listingId: listing.id,
        auctionId: a.id,
        articleId: article.id,
        title: article.title,
        summary: article.summary,
        category: article.category.name,
        author: article.author.displayName,
        authorId: article.author.id,
        floorPrice: floor,
        reservePrice: listing.reservePrice != null ? Number(listing.reservePrice) : null,
        allowedCategories: listing.allowedCategories,
        endsAt: a.endsAt.toISOString(),
        status: a.status,
        bidCount: a.bids.length,
        topBid,
        minNextBid: topBid > 0 ? round2(topBid + MARKETPLACE_DEFAULTS.bidIncrement) : floor,
        isOwn: true,
        myBid: null,
        bids: a.bids.map((b) => ({
          bidId: b.id,
          bidder: b.bidder.displayName,
          bidderId: b.bidderId,
          amount: Number(b.amount),
          status: b.status,
          createdAt: b.createdAt.toISOString(),
        })),
        settlementPreview: settlementPrice(activeAmounts, floor),
        placement: a.placement
          ? {
              id: a.placement.id,
              brandName: creative.brandName ?? "Sponsor",
              tagline: creative.tagline ?? null,
              status: a.placement.status,
              liveFrom: a.placement.liveFrom?.toISOString() ?? null,
              liveUntil: a.placement.liveUntil?.toISOString() ?? null,
              amount: a.placement.creativeAsset && typeof a.placement.creativeAsset === "object" && "amount" in a.placement.creativeAsset
                ? Number((a.placement.creativeAsset as { amount?: number }).amount ?? 0)
                : null,
            }
          : null,
      };
    });
}

/** Published articles the author can still open a sponsorship listing on. */
export async function listListableArticles(authorId: string) {
  const articles = await prisma.article.findMany({
    where: { authorId, status: "published", listings: { none: {} } },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, category: { select: { name: true } } },
  });
  return articles.map((a) => ({ id: a.id, title: a.title, category: a.category.name }));
}

export interface ActivePlacement {
  brandName: string;
  tagline: string | null;
  category: string | null;
}

/** The live labeled sponsor placement on an article, if any (for the reader view). */
export async function getActivePlacement(articleId: string): Promise<ActivePlacement | null> {
  const placement = await prisma.brandingPlacement.findFirst({
    where: {
      articleId,
      status: "live",
      OR: [{ liveUntil: null }, { liveUntil: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!placement) return null;
  const creative = (placement.creativeAsset ?? {}) as {
    brandName?: string;
    tagline?: string;
    category?: string;
  };
  return {
    brandName: creative.brandName ?? "Sponsor",
    tagline: creative.tagline ?? null,
    category: creative.category ?? null,
  };
}
