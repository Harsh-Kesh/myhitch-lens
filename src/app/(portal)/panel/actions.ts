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

  await prisma.listing.create({
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

  // First-price: the buyer pays exactly what they bid (floor-guaranteed at bid time).
  const floor = Number(auction.listing!.floorPrice);
  const price = Math.max(floor, Number(bid.amount));
  const fee = feeFor("sponsorship", price); // 20% marketplace fee
  const net = round2(price - fee);
  const brandName = bid.brandName ?? bid.bidder.displayName;

  // Auto-apply the agreed media-removal term to the article content, if requested.
  const stripped = bid.removeMedia ? stripMediaFromContent(article.content) : null;
  const mediaRemoved = stripped?.removed ?? 0;

  await prisma.$transaction([
    // Winner + losers.
    prisma.bid.update({ where: { id: bid.id }, data: { status: "won" } }),
    prisma.bid.updateMany({
      where: { auctionId: auction.id, id: { not: bid.id }, status: { in: ["active", "outbid"] } },
      data: { status: "lost" },
    }),
    // Ownership transfers to the buyer; author credit (authorId) is untouched.
    // The agreed media-removal term is auto-applied to the content here.
    prisma.article.update({
      where: { id: article.id },
      data: {
        ownerId: bid.bidder.id,
        lane: "hybrid",
        ...(stripped ? { content: stripped.content } : {}),
      },
    }),
    // Record the sale + agreed change request as a labeled placement.
    prisma.brandingPlacement.create({
      data: {
        articleId: article.id,
        auctionId: auction.id,
        brandId: bid.bidder.id,
        status: "live",
        liveFrom: new Date(),
        creativeAsset: {
          brandName,
          changeRequest: bid.changeRequest ?? null,
          category: article.category.name,
          amount: price,
          mediaRemoved,
        },
      },
    }),
    prisma.auction.update({ where: { id: auction.id }, data: { status: "settled" } }),
    // Money conservation: buyer pays, author receives net of fee.
    prisma.wallet.upsert({
      where: { userId: article.authorId },
      update: { balance: { increment: net } },
      create: { userId: article.authorId, balance: net },
    }),
    prisma.wallet.upsert({
      where: { userId: bid.bidder.id },
      update: { balance: { decrement: price } },
      create: { userId: bid.bidder.id, balance: -price },
    }),
    prisma.revenueLedger.create({
      data: {
        userId: article.authorId,
        articleId: article.id,
        type: "report_sale",
        gross: price,
        feeApplied: fee,
        net,
        meta: { kind: "ownership_sale", buyer: brandName, auctionId: auction.id },
      },
    }),
    // Notify both sides.
    prisma.notification.createMany({
      data: [
        {
          userId: bid.bidder.id,
          type: "bid_won",
          text: `Your offer on "${article.title}" was accepted — you now own this article.${
            mediaRemoved > 0 ? ` ${mediaRemoved} media item(s) were removed as agreed.` : ""
          }`,
        },
        {
          userId: article.authorId,
          type: "sale",
          text: `Ownership of "${article.title}" sold: A$${net.toFixed(2)} added to your wallet (A$${price.toFixed(2)} less fees).`,
        },
      ],
    }),
  ]);

  revalidatePath("/panel");
  revalidatePath("/author-dashboard");
  revalidatePath(`/article?id=${article.id}`);
  return { ok: true };
}
