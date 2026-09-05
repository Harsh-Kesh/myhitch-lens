"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { mintProvenance } from "@/lib/provenance";
import { feeFor, round2 } from "@/lib/marketplace";
import { EXCHANGE_ELIGIBLE_STATUSES, EXCHANGE_OPEN_STATUSES, isCopyrightClear } from "@/lib/exchange";
import { isSuspended } from "@/lib/authGuards";
import { isEligibleToSubmit } from "@/lib/verification";
import { syncContributorRank } from "@/lib/ranking";
import { isValidAbnChecksum } from "@/lib/abn";
import { ABN_COUNTRY } from "@/lib/platformConfig";
import type { ExchangeOpportunityType } from "@prisma/client";

export type ActionResult = { error: string } | { ok: true };

async function requireAuthor() {
  const session = await auth();
  if (!session?.user || session.user.role !== "author") throw new Error("Not authorized");
  if (await isSuspended(session.user.id)) throw new Error("Your account is suspended.");
  return session.user;
}

async function requireEditor() {
  const session = await auth();
  if (!session?.user || !["editor", "admin"].includes(session.user.role)) {
    throw new Error("Not authorized");
  }
  return session.user;
}

async function logEvent(opportunityId: string, actorId: string | null, action: string, note?: string) {
  await prisma.exchangeOpportunityEvent.create({
    data: { opportunityId, actorId, action, note },
  });
}

/** Author routes an unpublished article to the Exchange Hub instead of publishing it directly. */
export async function submitToExchangeHub(input: {
  articleId: string;
  type: ExchangeOpportunityType;
  description: string;
  expectedValue?: number | null;
  closingAt?: string | null;
  brandPlacementNotes?: string;
  sponsorAckRequirements?: string;
  commercialConditions?: string;
}): Promise<ActionResult> {
  const user = await requireAuthor();

  const { eligible, missing } = await isEligibleToSubmit(user.id);
  if (!eligible) {
    return { error: `Get verified before submitting — complete your profile: ${missing.join(", ")}.` };
  }

  // Real sponsorship money changes hands here, so — for Australian authors —
  // a valid ABN must be on file, checked directly rather than only relying on
  // the general verification gate above (which is a broader, evolving rule).
  const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { country: true, abn: true } });
  if (profile?.country === ABN_COUNTRY && !(profile.abn && isValidAbnChecksum(profile.abn))) {
    return { error: "Add a valid ABN to your profile before submitting to the Exchange Hub." };
  }

  const description = input.description.trim();
  if (!description) return { error: "Describe the opportunity for reviewing businesses." };

  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { authorId: true, status: true, title: true },
  });
  if (!article) return { error: "Article not found." };
  if (article.authorId !== user.id) return { error: "Not your article." };
  if (!EXCHANGE_ELIGIBLE_STATUSES.includes(article.status as (typeof EXCHANGE_ELIGIBLE_STATUSES)[number])) {
    return { error: "Only unpublished articles can be submitted to the Exchange Hub." };
  }
  if (!(await isCopyrightClear(input.articleId))) {
    return { error: "Only articles with confirmed original rights and no open copyright complaint can go to the Exchange Hub." };
  }

  const existingOpen = await prisma.exchangeOpportunity.findFirst({
    where: { articleId: input.articleId, status: { in: EXCHANGE_OPEN_STATUSES } },
  });
  if (existingOpen) return { error: "This article already has an open Exchange Hub submission." };

  const opportunity = await prisma.exchangeOpportunity.create({
    data: {
      articleId: input.articleId,
      authorId: user.id,
      type: input.type,
      description,
      expectedValue: input.expectedValue != null ? round2(Number(input.expectedValue)) : null,
      closingAt: input.closingAt ? new Date(input.closingAt) : null,
      brandPlacementNotes: input.brandPlacementNotes?.trim() || null,
      sponsorAckRequirements: input.sponsorAckRequirements?.trim() || null,
      commercialConditions: input.commercialConditions?.trim() || null,
    },
  });

  const editors = await prisma.user.findMany({
    where: { role: { in: ["editor", "admin"] } },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.article.update({
      where: { id: input.articleId },
      data: { status: "pending_exchange", destination: "exchange_hub" },
    }),
    prisma.notification.createMany({
      data: editors.map((e) => ({
        userId: e.id,
        type: "exchange_submitted",
        text: `New Exchange Hub opportunity submitted: "${article.title}" — review it in the Editorial Queue.`,
      })),
    }),
  ]);
  await logEvent(opportunity.id, user.id, "submitted", description);

  revalidatePath("/exchange");
  revalidatePath("/editorial");
  return { ok: true };
}

/** Author withdraws a submission that hasn't been resolved yet — the article returns to normal review. */
export async function cancelExchangeSubmission(opportunityId: string): Promise<ActionResult> {
  const user = await requireAuthor();

  const opportunity = await prisma.exchangeOpportunity.findUnique({ where: { id: opportunityId } });
  if (!opportunity) return { error: "Opportunity not found." };
  if (opportunity.authorId !== user.id) return { error: "Not your submission." };
  if (!EXCHANGE_OPEN_STATUSES.includes(opportunity.status)) return { error: "This submission is already resolved." };

  await prisma.$transaction([
    prisma.exchangeOpportunity.update({ where: { id: opportunityId }, data: { status: "cancelled" } }),
    prisma.article.update({
      where: { id: opportunity.articleId },
      data: { status: "in_review", destination: "main_app" },
    }),
  ]);
  await logEvent(opportunityId, user.id, "cancelled");

  revalidatePath("/exchange");
  revalidatePath("/editorial");
  return { ok: true };
}

/**
 * Once a sponsorship is live, the author can still pull the article back to
 * the ordinary main-app feed — the deal already struck and the money already
 * paid both stand; this only changes where the article is routed going
 * forward. An article is always exactly one of exchange_hub / main_app,
 * never both — this is the one documented path back from exchange_hub.
 */
export async function revertToMainApp(opportunityId: string): Promise<ActionResult> {
  const user = await requireAuthor();

  const opportunity = await prisma.exchangeOpportunity.findUnique({ where: { id: opportunityId } });
  if (!opportunity) return { error: "Opportunity not found." };
  if (opportunity.authorId !== user.id) return { error: "Not your submission." };
  if (opportunity.status !== "published") return { error: "Only a published Exchange Hub agreement can be reverted." };

  const article = await prisma.article.findUnique({
    where: { id: opportunity.articleId },
    select: { destination: true, title: true },
  });
  if (article?.destination !== "exchange_hub") {
    return { error: "This article isn't currently routed through the Exchange Hub." };
  }

  await prisma.$transaction([
    prisma.article.update({ where: { id: opportunity.articleId }, data: { destination: "main_app" } }),
    prisma.notification.create({
      data: {
        userId: user.id,
        type: "exchange_reverted",
        text: `"${article.title}" is no longer marked as an Exchange Hub sponsorship — it now shows as a regular MYHitch Lens article.`,
      },
    }),
  ]);
  await logEvent(opportunityId, user.id, "reverted_to_main_app");

  revalidatePath("/exchange");
  revalidatePath("/explore");
  revalidatePath("/article");
  return { ok: true };
}

/**
 * Records the outcome of negotiation — stands in for what MYHitch Connect will
 * eventually report back once a real Exchange Hub exists. Moves the
 * opportunity to `agreement_pending`, awaiting the separate approval step.
 */
export async function recordExchangeAgreement(input: {
  opportunityId: string;
  agreedBrandName: string;
  agreedValue: number;
  agreedTerms?: string;
}): Promise<ActionResult> {
  const editor = await requireEditor();

  const brandName = input.agreedBrandName.trim();
  if (!brandName) return { error: "Brand/sponsor name is required." };
  const value = round2(Number(input.agreedValue));
  if (!Number.isFinite(value) || value <= 0) return { error: "Enter a valid agreed value." };

  const opportunity = await prisma.exchangeOpportunity.findUnique({ where: { id: input.opportunityId } });
  if (!opportunity) return { error: "Opportunity not found." };
  if (!EXCHANGE_OPEN_STATUSES.includes(opportunity.status)) return { error: "This opportunity is already resolved." };

  await prisma.exchangeOpportunity.update({
    where: { id: input.opportunityId },
    data: {
      status: "agreement_pending",
      agreedBrandName: brandName,
      agreedValue: value,
      agreedTerms: input.agreedTerms?.trim() || null,
    },
  });
  await logEvent(input.opportunityId, editor.id, "agreement_recorded", `${brandName} — A$${value.toFixed(2)}`);

  revalidatePath("/editorial");
  return { ok: true };
}

/**
 * MYHitch Approval — applies the agreed sponsorship and publishes the article.
 * Credits the author's wallet the same way an ownership sale does (sponsorship
 * fee split), so the payout flow (Stripe Connect) works identically either way.
 */
export async function approveExchangeOpportunity(opportunityId: string): Promise<ActionResult> {
  const editor = await requireEditor();

  const opportunity = await prisma.exchangeOpportunity.findUnique({
    where: { id: opportunityId },
    include: { article: { select: { title: true, authorId: true } } },
  });
  if (!opportunity) return { error: "Opportunity not found." };
  if (opportunity.status !== "agreement_pending") {
    return { error: "Record the agreed terms before approving." };
  }
  if (opportunity.agreedValue == null || !opportunity.agreedBrandName) {
    return { error: "Missing agreed terms." };
  }

  const value = Number(opportunity.agreedValue);
  const fee = feeFor("sponsorship", value);
  const net = round2(value - fee);

  // Guard the status transition inside the transaction itself (not just the
  // read above) — updateMany's `where` re-checks the current status at write
  // time, so two concurrent approve clicks can't both credit the wallet for
  // the same deal. Only the first to commit succeeds; the second sees the
  // already-updated status and gets a clean "already resolved" error.
  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.exchangeOpportunity.updateMany({
      where: { id: opportunityId, status: "agreement_pending" },
      data: { status: "published", resolvedById: editor.id, resolvedAt: new Date() },
    });
    if (claim.count !== 1) {
      return { error: "This opportunity was already resolved." } as const;
    }

    await tx.article.update({
      where: { id: opportunity.articleId },
      data: { status: "published", verified: true, publishedAt: new Date() },
    });
    await tx.wallet.upsert({
      where: { userId: opportunity.authorId },
      update: { balance: { increment: net } },
      create: { userId: opportunity.authorId, balance: net },
    });
    await tx.revenueLedger.create({
      data: {
        userId: opportunity.authorId,
        articleId: opportunity.articleId,
        type: "sponsorship",
        gross: value,
        feeApplied: fee,
        net,
        meta: { kind: "exchange_opportunity", opportunityId, brand: opportunity.agreedBrandName },
      },
    });
    await tx.notification.create({
      data: {
        userId: opportunity.authorId,
        type: "exchange_approved",
        text: `Your Exchange Hub agreement with ${opportunity.agreedBrandName} was approved — "${opportunity.article.title}" is now published (A$${net.toFixed(2)} added to your wallet).`,
      },
    });
    return { ok: true } as const;
  });

  if ("error" in result) return result;

  await mintProvenance(opportunity.articleId);
  await logEvent(opportunityId, editor.id, "approved_and_published");
  await syncContributorRank(opportunity.authorId);

  revalidatePath("/editorial");
  revalidatePath("/exchange");
  revalidatePath("/explore");
  revalidatePath("/author-dashboard");
  return { ok: true };
}

/** Rejects the opportunity outright — the article returns to normal editorial review. */
export async function rejectExchangeOpportunity(opportunityId: string, note: string): Promise<ActionResult> {
  const editor = await requireEditor();
  const text = note.trim();
  if (!text) return { error: "A reason is required." };

  const opportunity = await prisma.exchangeOpportunity.findUnique({
    where: { id: opportunityId },
    include: { article: { select: { title: true } } },
  });
  if (!opportunity) return { error: "Opportunity not found." };
  if (!EXCHANGE_OPEN_STATUSES.includes(opportunity.status)) return { error: "This opportunity is already resolved." };

  await prisma.$transaction([
    prisma.exchangeOpportunity.update({
      where: { id: opportunityId },
      data: { status: "rejected", resolvedById: editor.id, resolvedAt: new Date() },
    }),
    prisma.article.update({
      where: { id: opportunity.articleId },
      data: { status: "in_review", destination: "main_app" },
    }),
    prisma.notification.create({
      data: {
        userId: opportunity.authorId,
        type: "exchange_rejected",
        text: `Your Exchange Hub submission for "${opportunity.article.title}" was rejected: ${text}. It's back in the normal editorial queue.`,
      },
    }),
  ]);
  await logEvent(opportunityId, editor.id, "rejected", text);

  revalidatePath("/editorial");
  revalidatePath("/exchange");
  revalidatePath("/author-dashboard");
  return { ok: true };
}
