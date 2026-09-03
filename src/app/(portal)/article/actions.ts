"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import { CURRENCY, DONATION_DEFAULTS } from "@/lib/platformConfig";

/**
 * Record a read: increment the article's view counter and log an analytics
 * event. The author's own views are ignored so metrics stay honest. Called
 * once per session per article from the client (deduped there).
 */
export async function recordArticleView(articleId: string): Promise<void> {
  const session = await auth();
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, status: true },
  });
  if (!article || article.status !== "published") return;
  // Don't let the author inflate their own view count.
  if (session?.user && session.user.id === article.authorId) return;

  await prisma.$transaction([
    prisma.article.update({ where: { id: articleId }, data: { viewsCount: { increment: 1 } } }),
    prisma.analyticsEvent.create({
      data: { articleId, userId: session?.user?.id ?? null, kind: "view" },
    }),
  ]);
}

/** File a copyright/infringement report against an article → moderation queue. */
export async function reportCopyright(
  articleId: string,
  details: string,
): Promise<{ error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user) return { error: "Please sign in to report." };
  const text = details.trim();
  if (!text) return { error: "Describe the issue so a moderator can act on it." };

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { title: true },
  });
  if (!article) return { error: "Article not found." };

  await prisma.$transaction([
    prisma.disputeTicket.create({
      data: {
        userId: session.user.id,
        subject: `${articleId} — ${article.title}`,
        reason: "copyright",
        justify: text,
      },
    }),
    prisma.notification.createMany({
      data: (
        await prisma.user.findMany({ where: { role: { in: ["editor", "admin"] } }, select: { id: true } })
      ).map((u) => ({
        userId: u.id,
        type: "copyright_report",
        text: `Copyright report filed against "${article.title}".`,
      })),
    }),
  ]);

  return { ok: true };
}

/** Author files a counter-notice against a copyright takedown of their article. */
export async function appealTakedown(
  articleId: string,
  appealText: string,
): Promise<{ error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user) return { error: "Please sign in." };
  const text = appealText.trim();
  if (!text) return { error: "Explain why the removal should be reversed." };

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, status: true, title: true },
  });
  if (!article) return { error: "Article not found." };
  if (article.authorId !== session.user.id) return { error: "Not your article." };
  if (article.status !== "rejected") return { error: "This article hasn't been removed." };

  const ticket = await prisma.disputeTicket.findFirst({
    where: { subject: { startsWith: `${articleId} — ` }, reason: "copyright", status: "resolved" },
    orderBy: { createdAt: "desc" },
  });
  if (!ticket) return { error: "No copyright takedown found for this article." };
  if (ticket.appealStatus !== "none") return { error: "An appeal has already been filed for this removal." };

  await prisma.$transaction([
    prisma.disputeTicket.update({
      where: { id: ticket.id },
      data: { appealStatus: "pending", appealText: text, appealedAt: new Date() },
    }),
    prisma.notification.createMany({
      data: (
        await prisma.user.findMany({ where: { role: { in: ["editor", "admin"] } }, select: { id: true } })
      ).map((u) => ({
        userId: u.id,
        type: "appeal",
        text: `${session.user.name ?? "An author"} appealed the removal of "${article.title}".`,
      })),
    }),
  ]);

  return { ok: true };
}

const EDITORIAL_APPEAL_REASONS = ["plagiarism", "category", "editorial", "other"] as const;
export type EditorialAppealReason = (typeof EDITORIAL_APPEAL_REASONS)[number];

/**
 * Author disputes a non-copyright editorial call on their own article — an
 * inaccurate plagiarism flag, a miscategorisation, a rejection they think was
 * unfair, or anything else. Separate from `appealTakedown`, which is only for
 * reversing a copyright takedown.
 */
export async function fileEditorialAppeal(input: {
  articleId: string;
  reason: EditorialAppealReason;
  justify: string;
}): Promise<{ error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user) return { error: "Please sign in." };
  if (!EDITORIAL_APPEAL_REASONS.includes(input.reason)) return { error: "Choose a valid reason." };
  const text = input.justify.trim();
  if (!text) return { error: "Explain the issue so an editor can act on it." };

  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { authorId: true, title: true },
  });
  if (!article) return { error: "Article not found." };
  if (article.authorId !== session.user.id) return { error: "Not your article." };

  const existing = await prisma.disputeTicket.findFirst({
    where: {
      subject: { startsWith: `${input.articleId} — ` },
      reason: input.reason,
      status: { in: ["open", "under_review"] },
    },
  });
  if (existing) return { error: "You already have an open appeal of this type for this article." };

  // Cap total editorial appeal attempts per article, regardless of reason —
  // prevents indefinite re-filing after each rejection.
  const priorAppealCount = await prisma.disputeTicket.count({
    where: {
      subject: { startsWith: `${input.articleId} — ` },
      reason: { in: [...EDITORIAL_APPEAL_REASONS] },
    },
  });
  if (priorAppealCount >= 2) {
    return { error: "You've reached the maximum of 2 appeals for this article." };
  }

  await prisma.$transaction([
    prisma.disputeTicket.create({
      data: {
        userId: session.user.id,
        subject: `${input.articleId} — ${article.title}`,
        reason: input.reason,
        justify: text,
      },
    }),
    prisma.notification.createMany({
      data: (
        await prisma.user.findMany({ where: { role: { in: ["editor", "admin"] } }, select: { id: true } })
      ).map((u) => ({
        userId: u.id,
        type: "appeal",
        text: `${session.user.name ?? "An author"} filed an appeal on "${article.title}".`,
      })),
    }),
  ]);

  revalidatePath("/author-dashboard");
  return { ok: true };
}

/** Start a Stripe Checkout session for a one-time reader → author donation. */
export async function createDonationCheckout(
  articleId: string,
  amount: number,
): Promise<{ error: string } | { url: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Please sign in to send support." };
  if (!isStripeConfigured()) return { error: "Donations aren't set up yet — check back soon." };

  if (!Number.isFinite(amount) || amount < DONATION_DEFAULTS.minAmount || amount > DONATION_DEFAULTS.maxAmount) {
    return { error: `Choose an amount between $${DONATION_DEFAULTS.minAmount} and $${DONATION_DEFAULTS.maxAmount}.` };
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { title: true, authorId: true, status: true },
  });
  if (!article || article.status !== "published") return { error: "Article not found." };
  if (article.authorId === session.user.id) return { error: "You can't donate to your own article." };

  const base = appBaseUrl();
  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: CURRENCY.toLowerCase(),
          product_data: { name: `Support: ${article.title}` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: "donation",
      articleId,
      authorId: article.authorId,
      donorId: session.user.id,
    },
    success_url: `${base}/article?id=${articleId}&donation=success`,
    cancel_url: `${base}/article?id=${articleId}&donation=cancelled`,
  });

  if (!checkoutSession.url) return { error: "Could not start checkout. Please try again." };
  return { url: checkoutSession.url };
}

/** Toggle the current user's like on an article and keep the counter in sync. */
export async function toggleLike(articleId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const userId = session.user.id;

  const existing = await prisma.like.findUnique({
    where: { userId_articleId: { userId, articleId } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.like.delete({ where: { userId_articleId: { userId, articleId } } }),
      prisma.article.update({ where: { id: articleId }, data: { likesCount: { decrement: 1 } } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.like.create({ data: { userId, articleId } }),
      prisma.article.update({ where: { id: articleId }, data: { likesCount: { increment: 1 } } }),
    ]);
  }

  revalidatePath("/article");
  revalidatePath("/explore");
}

/** Toggle the current user's bookmark on an article. */
export async function toggleBookmark(articleId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const userId = session.user.id;

  const existing = await prisma.bookmark.findUnique({
    where: { userId_articleId: { userId, articleId } },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { userId_articleId: { userId, articleId } } });
  } else {
    await prisma.bookmark.create({ data: { userId, articleId } });
  }

  revalidatePath("/article");
  revalidatePath("/reader-dashboard");
}

/** Follow / unfollow an author from the article page. */
export async function toggleFollow(authorId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const followerId = session.user.id;
  if (followerId === authorId) return; // can't follow yourself

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: authorId } },
  });
  if (existing) {
    await prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId: authorId } },
    });
  } else {
    await prisma.follow.create({ data: { followerId, followingId: authorId } });
  }

  revalidatePath("/article");
  revalidatePath("/reader-dashboard");
}

/** Post a comment as the current user. */
export async function postComment(articleId: string, text: string): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return;
  const body = text.trim();
  if (!body) return;

  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { authorId: true } });
  if (!article) return { error: "Article not found." };
  if (article.authorId === session.user.id) {
    return { error: "You can't comment on your own article." };
  }

  await prisma.comment.create({
    data: { articleId, userId: session.user.id, text: body },
  });
  revalidatePath("/article");
}
