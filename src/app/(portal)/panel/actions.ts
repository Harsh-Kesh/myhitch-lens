"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MARKETPLACE_DEFAULTS } from "@/lib/platformConfig";
import { feeFor, round2 } from "@/lib/marketplace";

export type ActionResult = { error: string } | { ok: true };

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  // Staff accounts have no task in the marketplace — they're neither buyers
  // nor sellers — matching the route-level rule in auth.config.ts.
  if (["editor", "admin"].includes(session.user.role)) {
    throw new Error("Not available for staff accounts.");
  }
  return session.user;
}

const MEDIA_NODE_TYPES = new Set(["image", "figure", "video", "audio"]);

/** Remove media nodes (images/video/audio) from Tiptap JSON, leaving text intact. */
function stripMediaFromContent(content: string): { content: string; removed: number } {
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return { content, removed: 0 };
  }
  let removed = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { content?: unknown[] };
    if (Array.isArray(n.content)) {
      n.content = n.content.filter((child) => {
        const type = (child as { type?: string })?.type;
        if (type && MEDIA_NODE_TYPES.has(type)) {
          removed += 1;
          return false;
        }
        return true;
      });
      n.content.forEach(walk);
    }
  };
  walk(doc);
  return { content: JSON.stringify(doc), removed };
}

/** Author lists one of their published, still-owned articles for ownership sale. */
export async function createListing(input: {
  articleId: string;
  saleType?: "auction" | "fixed";
  floorPrice: number;
  reservePrice?: number | null;
  slots?: number;
  allowedCategories: string[];
  durationDays?: number;
}): Promise<ActionResult> {
  const user = await requireUser();

  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { authorId: true, status: true, ownerId: true },
  });
  if (!article) return { error: "Article not found." };
  if (article.authorId !== user.id) return { error: "Not your article." };
  if (article.status !== "published") return { error: "Only published articles can be listed." };
  if (article.ownerId) return { error: "This article's ownership has already been sold." };

  const saleType = input.saleType === "fixed" ? "fixed" : "auction";

  const floor = round2(Number(input.floorPrice));
  if (!Number.isFinite(floor) || floor < MARKETPLACE_DEFAULTS.minBid) {
    return {
      error:
        saleType === "fixed"
          ? `Price must be at least A$${MARKETPLACE_DEFAULTS.minBid}.`
          : `Floor price must be at least A$${MARKETPLACE_DEFAULTS.minBid}.`,
    };
  }
  // A reserve only makes sense when there's bidding to reserve against.
  const reserve = saleType === "auction" && input.reservePrice != null ? round2(Number(input.reservePrice)) : null;
  if (reserve != null && reserve < floor) {
    return { error: "Reserve price cannot be below the floor price." };
  }

  const durationDays = input.durationDays ?? MARKETPLACE_DEFAULTS.auctionDurationDays;
  const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  await prisma.listing.create({
    data: {
      articleId: input.articleId,
      slots: input.slots ?? 1,
      saleType,
      floorPrice: floor,
      reservePrice: reserve,
      allowedCategories: input.allowedCategories,
      auctions: {
        create: { type: "sponsorship", status: "open", reserve, endsAt },
      },
    },
  });

  revalidatePath("/panel");
  revalidatePath("/author-dashboard");
  return { ok: true };
}

/** A member bids to acquire an article, optionally attaching a change request. */
export async function placeBid(input: {
  auctionId: string;
  amount: number;
  brandCategory: string;
  brandName?: string;
  changeRequest?: string;
  removeMedia?: boolean;
  autoBidCeiling?: number | null;
}): Promise<ActionResult> {
  const user = await requireUser();

  const auction = await prisma.auction.findUnique({
    where: { id: input.auctionId },
    include: {
      listing: { include: { article: { select: { authorId: true } } } },
      bids: { where: { status: { in: ["active", "won"] } }, orderBy: { amount: "desc" } },
    },
  });
  if (!auction || auction.type !== "sponsorship") return { error: "Auction not found." };
  if (auction.listing?.saleType === "fixed") return { error: "This article is for sale at a fixed price — use Buy Now." };
  if (auction.status !== "open") return { error: "This auction is closed." };
  if (auction.endsAt.getTime() < Date.now()) return { error: "This auction has ended." };

  const article = auction.listing?.article;
  if (!article) return { error: "Listing not found." };
  if (article.authorId === user.id) return { error: "You can't bid on your own article." };

  // Brand-safety gate: bidder's category must be permitted for this listing.
  const allowed = auction.listing!.allowedCategories;
  if (allowed.length > 0 && !allowed.includes(input.brandCategory)) {
    return { error: `Brand category "${input.brandCategory}" is not permitted for this article.` };
  }

  const amount = round2(Number(input.amount));
  const floor = Number(auction.listing!.floorPrice);
  const topBid = auction.bids.length ? Number(auction.bids[0].amount) : 0;
  const minNextBid = topBid > 0 ? round2(topBid + MARKETPLACE_DEFAULTS.bidIncrement) : floor;
  if (!Number.isFinite(amount) || amount < minNextBid) {
    return { error: `Bid must be at least A$${minNextBid}.` };
  }

  await prisma.$transaction([
    prisma.bid.updateMany({
      where: { auctionId: auction.id, status: "active" },
      data: { status: "outbid" },
    }),
    prisma.bid.create({
      data: {
        auctionId: auction.id,
        bidderId: user.id,
        amount,
        brandName: input.brandName?.trim() || null,
        changeRequest: input.changeRequest?.trim() || null,
        removeMedia: input.removeMedia ?? false,
        autoBidCeiling: input.autoBidCeiling != null ? round2(Number(input.autoBidCeiling)) : null,
        status: "active",
      },
    }),
    prisma.notification.create({
      data: {
        userId: article.authorId,
        type: "bid",
        text: `New offer of A$${amount.toFixed(2)} to acquire your listed article.`,
      },
    }),
  ]);

  revalidatePath("/panel");
  return { ok: true };
}

interface SettleArgs {
  bidId: string;
  bidderId: string;
  bidderName: string;
  brandName: string | null;
  changeRequest: string | null;
  removeMedia: boolean;
  amount: number;
  auctionId: string;
  articleId: string;
  articleAuthorId: string;
  articleTitle: string;
  articleContent: string;
  articleCategoryName: string;
  listingFloorPrice: number;
}

/** Thrown inside settleSale's transaction to abort and roll back everything — returning a value from an interactive transaction commits it, only throwing rolls back. */
class SettlementAbort extends Error {}

/**
 * Shared settlement: ownership transfer, first-price funds, placement,
 * notifications. Retired from the UI (see panel/page.tsx) but left intact —
 * still fixed for correctness in case it's ever revived.
 */
async function settleSale(a: SettleArgs): Promise<ActionResult> {
  const price = Math.max(a.listingFloorPrice, a.amount);
  const fee = feeFor("reportSale", price); // matches the "report_sale" ledger type recorded below
  const net = round2(price - fee);
  const brandName = a.brandName ?? a.bidderName;

  const stripped = a.removeMedia ? stripMediaFromContent(a.articleContent) : null;
  const mediaRemoved = stripped?.removed ?? 0;

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional claims on the auction and the buyer's wallet, both
      // checked and applied before any other write — a failure here throws
      // to roll back the whole transaction, so two concurrent settlements
      // (or a buyer without enough funds) can never leave a partial state.
      const claim = await tx.auction.updateMany({
        where: { id: a.auctionId, status: { in: ["open", "closed"] } },
        data: { status: "settled" },
      });
      if (claim.count !== 1) throw new SettlementAbort("This article has already been sold.");

      const debit = await tx.wallet.updateMany({
        where: { userId: a.bidderId, balance: { gte: price } },
        data: { balance: { decrement: price } },
      });
      if (debit.count !== 1) throw new SettlementAbort("Insufficient wallet balance to complete this purchase.");

      await tx.bid.update({ where: { id: a.bidId }, data: { status: "won" } });
      await tx.bid.updateMany({
        where: { auctionId: a.auctionId, id: { not: a.bidId }, status: { in: ["active", "outbid"] } },
        data: { status: "lost" },
      });
      await tx.article.update({
        where: { id: a.articleId },
        data: {
          ownerId: a.bidderId,
          lane: "hybrid",
          ...(stripped ? { content: stripped.content } : {}),
        },
      });
      await tx.brandingPlacement.create({
        data: {
          articleId: a.articleId,
          auctionId: a.auctionId,
          brandId: a.bidderId,
          status: "live",
          liveFrom: new Date(),
          creativeAsset: {
            brandName,
            changeRequest: a.changeRequest,
            category: a.articleCategoryName,
            amount: price,
            mediaRemoved,
          },
        },
      });
      await tx.wallet.upsert({
        where: { userId: a.articleAuthorId },
        update: { balance: { increment: net } },
        create: { userId: a.articleAuthorId, balance: net },
      });
      await tx.revenueLedger.create({
        data: {
          userId: a.articleAuthorId,
          articleId: a.articleId,
          type: "report_sale",
          gross: price,
          feeApplied: fee,
          net,
          meta: { kind: "ownership_sale", buyer: brandName, auctionId: a.auctionId },
        },
      });
      await tx.notification.createMany({
        data: [
          {
            userId: a.bidderId,
            type: "bid_won",
            text: `Your purchase of "${a.articleTitle}" is complete — you now own this article.${
              mediaRemoved > 0 ? ` ${mediaRemoved} media item(s) were removed as agreed.` : ""
            }`,
          },
          {
            userId: a.articleAuthorId,
            type: "sale",
            text: `Ownership of "${a.articleTitle}" sold: A$${net.toFixed(2)} added to your wallet (A$${price.toFixed(2)} less fees).`,
          },
        ],
      });
    });
  } catch (err) {
    if (err instanceof SettlementAbort) return { error: err.message };
    throw err;
  }

  return { ok: true };
}

/**
 * Author accepts an offer → ownership transfers to the buyer (author keeps their
 * verified credit), first-price funds settle, agreed change request is recorded.
 */
export async function acceptBid(input: { bidId: string }): Promise<ActionResult> {
  const user = await requireUser();

  const bid = await prisma.bid.findUnique({
    where: { id: input.bidId },
    include: {
      bidder: { select: { id: true, displayName: true } },
      auction: {
        include: {
          listing: {
            include: {
              article: {
                select: { id: true, authorId: true, title: true, content: true, category: { select: { name: true } } },
              },
            },
          },
          placement: true,
        },
      },
    },
  });
  if (!bid) return { error: "Offer not found." };
  const auction = bid.auction;
  const article = auction.listing?.article;
  if (!article) return { error: "Listing not found." };
  if (article.authorId !== user.id) return { error: "Only the author can accept an offer." };
  // Accept while the auction is live ("open") or after it has expired ("closed").
  if (auction.status !== "open" && auction.status !== "closed") {
    return { error: "This auction is already settled." };
  }
  if (auction.placement) return { error: "This article has already been sold." };

  const result = await settleSale({
    bidId: bid.id,
    bidderId: bid.bidder.id,
    bidderName: bid.bidder.displayName,
    brandName: bid.brandName,
    changeRequest: bid.changeRequest,
    removeMedia: bid.removeMedia,
    amount: Number(bid.amount),
    auctionId: auction.id,
    articleId: article.id,
    articleAuthorId: article.authorId,
    articleTitle: article.title,
    articleContent: article.content,
    articleCategoryName: article.category.name,
    listingFloorPrice: Number(auction.listing!.floorPrice),
  });
  if ("error" in result) return result;

  revalidatePath("/panel");
  revalidatePath("/author-dashboard");
  revalidatePath(`/article?id=${article.id}`);
  return { ok: true };
}

/** Instant purchase of a fixed-price listing — no bidding, no author approval step. */
export async function buyFixedPrice(input: {
  auctionId: string;
  brandCategory: string;
  brandName?: string;
  changeRequest?: string;
  removeMedia?: boolean;
}): Promise<ActionResult> {
  const user = await requireUser();

  const auction = await prisma.auction.findUnique({
    where: { id: input.auctionId },
    include: {
      listing: { include: { article: { select: { id: true, authorId: true, title: true, content: true, category: { select: { name: true } } } } } },
      placement: true,
    },
  });
  if (!auction || auction.type !== "sponsorship") return { error: "Listing not found." };
  if (auction.listing?.saleType !== "fixed") return { error: "This listing isn't a fixed-price sale." };
  if (auction.status !== "open") return { error: "This listing is no longer available." };
  if (auction.endsAt.getTime() < Date.now()) return { error: "This listing has expired." };
  if (auction.placement) return { error: "This article has already been sold." };

  const article = auction.listing.article;
  if (article.authorId === user.id) return { error: "You can't buy your own article." };

  const allowed = auction.listing.allowedCategories;
  if (allowed.length > 0 && !allowed.includes(input.brandCategory)) {
    return { error: `Brand category "${input.brandCategory}" is not permitted for this article.` };
  }

  const price = Number(auction.listing.floorPrice);
  const bid = await prisma.bid.create({
    data: {
      auctionId: auction.id,
      bidderId: user.id,
      amount: price,
      brandName: input.brandName?.trim() || null,
      changeRequest: input.changeRequest?.trim() || null,
      removeMedia: input.removeMedia ?? false,
      status: "active",
    },
  });

  const result = await settleSale({
    bidId: bid.id,
    bidderId: user.id,
    bidderName: user.name ?? "Buyer",
    brandName: bid.brandName,
    changeRequest: bid.changeRequest,
    removeMedia: bid.removeMedia,
    amount: price,
    auctionId: auction.id,
    articleId: article.id,
    articleAuthorId: article.authorId,
    articleTitle: article.title,
    articleContent: article.content,
    articleCategoryName: article.category.name,
    listingFloorPrice: price,
  });
  if ("error" in result) return result;

  revalidatePath("/panel");
  revalidatePath("/author-dashboard");
  revalidatePath(`/article?id=${article.id}`);
  return { ok: true };
}
