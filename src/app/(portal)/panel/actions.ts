"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MARKETPLACE_DEFAULTS } from "@/lib/platformConfig";
import { feeFor, round2, settlementPrice } from "@/lib/marketplace";

export type ActionResult = { error: string } | { ok: true };

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session.user;
}

/** Author opens a sponsorship listing (auction) on one of their published articles. */
export async function createListing(input: {
  articleId: string;
  floorPrice: number;
  reservePrice?: number | null;
  slots?: number;
  allowedCategories: string[];
  durationDays?: number;
}): Promise<ActionResult> {
  const user = await requireUser();

  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { authorId: true, status: true, lane: true },
  });
  if (!article) return { error: "Article not found." };
  if (article.authorId !== user.id) return { error: "Not your article." };
  if (article.status !== "published") return { error: "Only published articles can be listed." };

  const floor = round2(Number(input.floorPrice));
  if (!Number.isFinite(floor) || floor < MARKETPLACE_DEFAULTS.minBid) {
    return { error: `Floor price must be at least A$${MARKETPLACE_DEFAULTS.minBid}.` };
  }
  const reserve = input.reservePrice != null ? round2(Number(input.reservePrice)) : null;
  if (reserve != null && reserve < floor) {
    return { error: "Reserve price cannot be below the floor price." };
  }

  const durationDays = input.durationDays ?? MARKETPLACE_DEFAULTS.auctionDurationDays;
  const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.listing.create({
      data: {
        articleId: input.articleId,
        slots: input.slots ?? 1,
        floorPrice: floor,
        reservePrice: reserve,
        allowedCategories: input.allowedCategories,
        auctions: {
          create: { type: "sponsorship", status: "open", reserve, endsAt },
        },
      },
    }),
    // Route the article into the panel lane (hybrid = public feed + panel sponsor).
    prisma.article.update({ where: { id: input.articleId }, data: { lane: "hybrid" } }),
  ]);

  revalidatePath("/panel");
  revalidatePath("/author-dashboard");
  return { ok: true };
}

/** A member places a sponsorship bid on an open auction. */
export async function placeBid(input: {
  auctionId: string;
  amount: number;
  brandCategory: string;
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
    // Existing active bids become "outbid".
    prisma.bid.updateMany({
      where: { auctionId: auction.id, status: "active" },
      data: { status: "outbid" },
    }),
    prisma.bid.create({
      data: {
        auctionId: auction.id,
        bidderId: user.id,
        amount,
        autoBidCeiling: input.autoBidCeiling != null ? round2(Number(input.autoBidCeiling)) : null,
        status: "active",
      },
    }),
    // Notify the author that a new offer arrived.
    prisma.notification.create({
      data: {
        userId: article.authorId,
        type: "bid",
        text: `New sponsorship bid of A$${amount.toFixed(2)} on your listed article.`,
      },
    }),
  ]);

  revalidatePath("/panel");
  return { ok: true };
}

/** Author accepts a bid → labeled placement goes live, funds settle to the wallet. */
export async function acceptBid(input: {
  bidId: string;
  tagline?: string;
}): Promise<ActionResult> {
  const user = await requireUser();

  const bid = await prisma.bid.findUnique({
    where: { id: input.bidId },
    include: {
      bidder: { select: { id: true, displayName: true } },
      auction: {
        include: {
          listing: {
            include: {
              article: { select: { id: true, authorId: true, title: true, category: { select: { name: true } } } },
            },
          },
          bids: { where: { status: { in: ["active", "outbid", "won"] } } },
          placement: true,
        },
      },
    },
  });
  if (!bid) return { error: "Bid not found." };
  const auction = bid.auction;
  const article = auction.listing?.article;
  if (!article) return { error: "Listing not found." };
  if (article.authorId !== user.id) return { error: "Only the author can accept a bid." };
  if (auction.status !== "open") return { error: "This auction is already settled." };
  if (auction.placement) return { error: "A sponsor is already placed on this article." };

  // Second-price settlement, capped at the accepted bid, floored at the reserve/floor.
  const floor = Number(auction.listing!.floorPrice);
  const activeAmounts = auction.bids.map((b) => Number(b.amount)).sort((a, b) => b - a);
  const acceptedAmount = Number(bid.amount);
  const price = Math.max(floor, Math.min(acceptedAmount, settlementPrice(activeAmounts, floor)));
  const fee = feeFor("sponsorship", price);
  const net = round2(price - fee);

  const now = new Date();
  const liveUntil = new Date(now.getTime() + MARKETPLACE_DEFAULTS.placementWindowDays * 24 * 60 * 60 * 1000);

  // Batched (non-interactive) transaction: one round-trip, no 5s interactive
  // timeout — these writes don't depend on each other's return values.
  await prisma.$transaction([
    // Winner + losers.
    prisma.bid.update({ where: { id: bid.id }, data: { status: "won" } }),
    prisma.bid.updateMany({
      where: { auctionId: auction.id, id: { not: bid.id }, status: { in: ["active", "outbid"] } },
      data: { status: "lost" },
    }),
    // Labeled placement goes live.
    prisma.brandingPlacement.create({
      data: {
        articleId: article.id,
        auctionId: auction.id,
        brandId: bid.bidder.id,
        status: "live",
        liveFrom: now,
        liveUntil,
        creativeAsset: {
          brandName: bid.bidder.displayName,
          tagline: input.tagline?.trim() || null,
          category: article.category.name,
          amount: price,
        },
      },
    }),
    prisma.auction.update({ where: { id: auction.id }, data: { status: "settled" } }),
    // Settle funds to the author (simulated escrow release): wallet + ledger.
    prisma.wallet.upsert({
      where: { userId: article.authorId },
      update: { balance: { increment: net } },
      create: { userId: article.authorId, balance: net },
    }),
    prisma.revenueLedger.create({
      data: {
        userId: article.authorId,
        articleId: article.id,
        type: "sponsorship",
        gross: price,
        feeApplied: fee,
        net,
        meta: { brand: bid.bidder.displayName, auctionId: auction.id },
      },
    }),
    // Notify both sides.
    prisma.notification.createMany({
      data: [
        {
          userId: bid.bidder.id,
          type: "bid_won",
          text: `Your sponsorship bid on "${article.title}" was accepted. Placement is now live.`,
        },
        {
          userId: article.authorId,
          type: "sponsorship",
          text: `Sponsorship settled: A$${net.toFixed(2)} added to your wallet (A$${price.toFixed(2)} less fees).`,
        },
      ],
    }),
  ]);

  revalidatePath("/panel");
  revalidatePath("/author-dashboard");
  revalidatePath(`/article?id=${article.id}`);
  return { ok: true };
}
