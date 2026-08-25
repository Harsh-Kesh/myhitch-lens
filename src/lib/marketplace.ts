import "server-only";

import { prisma } from "@/lib/prisma";
import { MARKETPLACE_DEFAULTS, PLATFORM_FEES, type PlatformFeeType } from "@/lib/platformConfig";

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** Platform fee (AUD) for a gross amount of a given revenue type. */
export function feeFor(type: PlatformFeeType, gross: number): number {
  return round2(gross * PLATFORM_FEES[type]);
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

/** Open ownership auctions available to bid on, newest first. */
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
  brandName: string;
  amount: number;
  changeRequest: string | null;
  removeMedia: boolean;
  status: string;
  createdAt: string;
}

export interface AuthorListing extends PanelListing {
  bids: ListingBid[];
  sale: {
    ownerName: string;
    brandName: string;
    changeRequest: string | null;
    amount: number | null;
    status: string;
  } | null;
}

/** All of an author's ownership auctions (any status) with bids + resulting sale. */
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
              owner: { select: { displayName: true } },
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
      const creative = (a.placement?.creativeAsset ?? {}) as {
        brandName?: string;
        changeRequest?: string;
        amount?: number;
      };
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
          brandName: b.brandName ?? b.bidder.displayName,
          amount: Number(b.amount),
          changeRequest: b.changeRequest ?? null,
          removeMedia: b.removeMedia,
          status: b.status,
          createdAt: b.createdAt.toISOString(),
        })),
        sale: a.placement
          ? {
              ownerName: article.owner?.displayName ?? creative.brandName ?? "Owner",
              brandName: creative.brandName ?? "Owner",
              changeRequest: creative.changeRequest ?? null,
              amount: creative.amount != null ? Number(creative.amount) : null,
              status: a.placement.status,
            }
          : null,
      };
    });
}

export interface OwnedArticle {
  articleId: string;
  title: string;
  category: string;
  author: string;
  brandName: string;
  changeRequest: string | null;
  price: number | null;
  acquiredAt: string | null;
}

/** Articles the viewer has acquired ownership of (with the agreed sale terms). */
export async function listOwnedArticles(ownerId: string): Promise<OwnedArticle[]> {
  const articles = await prisma.article.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      category: { select: { name: true } },
      author: { select: { displayName: true } },
      placements: {
        where: { brandId: ownerId },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return articles.map((a) => {
    const placement = a.placements[0];
    const creative = (placement?.creativeAsset ?? {}) as {
      brandName?: string;
      changeRequest?: string;
      amount?: number;
    };
    return {
      articleId: a.id,
      title: a.title,
      category: a.category.name,
      author: a.author.displayName,
      brandName: creative.brandName ?? "",
      changeRequest: creative.changeRequest ?? null,
      price: creative.amount != null ? Number(creative.amount) : null,
      acquiredAt: placement?.createdAt.toISOString() ?? null,
    };
  });
}

/** Published articles the author still fully owns and can list for sale. */
export async function listListableArticles(authorId: string) {
  const articles = await prisma.article.findMany({
    where: { authorId, status: "published", ownerId: null, listings: { none: {} } },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, category: { select: { name: true } } },
  });
  return articles.map((a) => ({ id: a.id, title: a.title, category: a.category.name }));
}

export interface OwnershipInfo {
  ownerName: string;
  brandName: string;
  tagline: string | null;
}

/**
 * Close auctions whose time has expired (lazy sweep — runs on panel load, no
 * cron needed). Expired auctions with standing offers move to `closed` (the
 * author is prompted to accept the top offer); those with none are `canceled`.
 * Ownership never transfers automatically — author acceptance stays mandatory.
 */
export async function sweepExpiredAuctions(): Promise<void> {
  const expired = await prisma.auction.findMany({
    where: { type: "sponsorship", status: "open", endsAt: { lt: new Date() } },
    select: {
      id: true,
      bids: { where: { status: { in: ["active", "outbid"] } }, select: { id: true } },
      listing: { select: { article: { select: { authorId: true, title: true } } } },
    },
  });
  if (expired.length === 0) return;

  const withOffers = expired.filter((a) => a.bids.length > 0);
  const withoutOffers = expired.filter((a) => a.bids.length === 0);

  const ops = [];
  if (withOffers.length > 0) {
    ops.push(
      prisma.auction.updateMany({
        where: { id: { in: withOffers.map((a) => a.id) } },
        data: { status: "closed" },
      }),
    );
  }
  if (withoutOffers.length > 0) {
    ops.push(
      prisma.auction.updateMany({
        where: { id: { in: withoutOffers.map((a) => a.id) } },
        data: { status: "canceled" },
      }),
    );
  }
  const notifications = expired
    .map((a) => {
      const article = a.listing?.article;
      if (!article) return null;
      return a.bids.length > 0
        ? {
            userId: article.authorId,
            type: "auction_ended",
            text: `Bidding closed on "${article.title}" with ${a.bids.length} offer(s) — review and accept the winner.`,
          }
        : {
            userId: article.authorId,
            type: "auction_ended",
            text: `Bidding closed on "${article.title}" with no offers. You can relist it anytime.`,
          };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);
  if (notifications.length > 0) {
    ops.push(prisma.notification.createMany({ data: notifications }));
  }

  await prisma.$transaction(ops);
}

/** Current ownership + branding to display on an article (null if author-owned). */
export async function getOwnership(articleId: string): Promise<OwnershipInfo | null> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      ownerId: true,
      owner: { select: { displayName: true } },
      placements: {
        where: { status: "live" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!article || !article.ownerId) return null;
  const creative = (article.placements[0]?.creativeAsset ?? {}) as {
    brandName?: string;
    changeRequest?: string;
  };
  return {
    ownerName: article.owner?.displayName ?? "New owner",
    brandName: creative.brandName ?? article.owner?.displayName ?? "New owner",
    tagline: creative.changeRequest ?? null,
  };
}
