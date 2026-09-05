"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import { CURRENCY, MARKETPLACE_DEFAULTS } from "@/lib/platformConfig";
import { round2 } from "@/lib/marketplace";
import { isSuspended } from "@/lib/authGuards";

async function requireAuthor() {
  const session = await auth();
  if (!session?.user || session.user.role !== "author") throw new Error("Not authorized");
  if (await isSuspended(session.user.id)) throw new Error("Your account is suspended.");
  return session.user;
}

export interface ConnectStatus {
  configured: boolean;
  connected: boolean;
  payoutsEnabled: boolean;
}

/**
 * Where the SIGNED-IN author's Stripe Connect account currently stands.
 * Deliberately takes no userId parameter — every exported function in a
 * "use server" file is a directly callable RPC endpoint regardless of which
 * page happens to import it, so the target user must always come from the
 * verified session, never from a caller-supplied argument.
 */
export async function getConnectStatus(): Promise<ConnectStatus> {
  const user = await requireAuthor();
  if (!isStripeConfigured()) return { configured: false, connected: false, payoutsEnabled: false };

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id }, select: { stripeConnectId: true } });
  if (!wallet?.stripeConnectId) return { configured: true, connected: false, payoutsEnabled: false };

  try {
    const account = await getStripe().accounts.retrieve(wallet.stripeConnectId);
    return { configured: true, connected: true, payoutsEnabled: !!account.payouts_enabled };
  } catch {
    // The stored account id no longer resolves (e.g. deleted in the Stripe
    // dashboard), or Stripe is unreachable — treat as not connected rather
    // than failing the page.
    return { configured: true, connected: false, payoutsEnabled: false };
  }
}

/**
 * Creates (if needed) the author's Stripe Express account and returns a
 * hosted onboarding link. Safe to call again mid-onboarding — Stripe account
 * links are single-use and short-lived, so "Finish connecting" re-runs this.
 */
export async function startStripeConnectOnboarding(): Promise<{ error: string } | { url: string }> {
  const user = await requireAuthor();
  if (!isStripeConfigured()) return { error: "Payouts aren't set up yet — check back soon." };

  const stripe = getStripe();

  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id }, select: { stripeConnectId: true } });

    let accountId = wallet?.stripeConnectId ?? null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email ?? undefined,
        capabilities: { transfers: { requested: true } },
      });
      accountId = account.id;
      await prisma.wallet.upsert({
        where: { userId: user.id },
        update: { stripeConnectId: accountId },
        create: { userId: user.id, stripeConnectId: accountId },
      });
    }

    const base = appBaseUrl();
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${base}/author-dashboard?connect=refresh`,
      return_url: `${base}/author-dashboard?connect=return`,
    });

    return { url: accountLink.url };
  } catch (err) {
    console.error("startStripeConnectOnboarding failed:", err);
    return { error: "Couldn't reach Stripe right now — please try again shortly." };
  }
}

/**
 * Transfers the author's full wallet balance to their connected Stripe
 * account. Stripe's own transfer/payout fee comes out of the connected
 * account, not the platform's — matching the "author bears the Stripe fee"
 * policy (see platformConfig.ts).
 *
 * Safety design (two phases, since an external Stripe call must never sit
 * inside a DB transaction holding row locks):
 *   1. Atomically "claim" the requested amount — a conditional decrement
 *      that only succeeds if the balance still covers it — and record a
 *      "pending" Payout row before calling Stripe at all. If two requests
 *      race (double-click, two tabs, two devices), only one claim can
 *      succeed; the loser is told to retry rather than double-withdrawing.
 *   2. Call Stripe with that Payout's id as the idempotency key, so a
 *      network-level SDK retry can't create a second real transfer for the
 *      same claim. On success, mark the payout "paid". On failure, refund
 *      the claimed amount and mark it "failed" so the author isn't left
 *      short and can cleanly retry.
 */
export async function requestPayout(amount: number): Promise<{ error: string } | { ok: true }> {
  const user = await requireAuthor();
  if (!isStripeConfigured()) return { error: "Payouts aren't set up yet — check back soon." };

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet?.stripeConnectId) return { error: "Connect your Stripe account first." };

  const balance = round2(Number(wallet.balance));
  const requested = round2(Number(amount));

  if (balance <= 0) {
    return { error: "You have no funds available to withdraw." };
  }
  if (!Number.isFinite(requested) || requested <= 0) {
    return { error: "Enter a valid amount." };
  }
  if (requested < MARKETPLACE_DEFAULTS.payoutMinimum) {
    return { error: `Minimum payout is A$${MARKETPLACE_DEFAULTS.payoutMinimum}.` };
  }
  if (requested > balance) {
    return { error: `You only have A$${balance.toFixed(2)} available.` };
  }

  let account;
  try {
    account = await getStripe().accounts.retrieve(wallet.stripeConnectId);
  } catch (err) {
    console.error("requestPayout: accounts.retrieve failed:", err);
    return { error: "Couldn't reach Stripe right now — please try again shortly." };
  }
  if (!account.payouts_enabled) {
    return { error: "Finish connecting your Stripe account before withdrawing." };
  }

  // Phase 1: claim the requested amount + create a pending record, atomically.
  // Guarding on balance >= requested (rather than an exact snapshot match)
  // means a legitimate new deposit landing in between doesn't spuriously
  // block the withdrawal — it only blocks if the balance would go negative.
  const payoutId = await prisma.$transaction(async (tx) => {
    const claim = await tx.wallet.updateMany({
      where: { userId: user.id, balance: { gte: requested } },
      data: { balance: { decrement: requested } },
    });
    if (claim.count !== 1) {
      throw new Error("Your balance just changed — please try again.");
    }
    const payout = await tx.payout.create({
      data: { userId: user.id, amount: requested, currency: CURRENCY, status: "pending" },
    });
    return payout.id;
  }).catch((err: Error) => {
    return { claimError: err.message };
  });

  if (typeof payoutId !== "string") {
    return { error: payoutId.claimError };
  }

  // Phase 2: the actual transfer, outside any DB transaction.
  try {
    const transfer = await getStripe().transfers.create(
      {
        amount: Math.round(requested * 100),
        currency: CURRENCY.toLowerCase(),
        destination: wallet.stripeConnectId,
      },
      { idempotencyKey: payoutId },
    );

    await prisma.$transaction([
      prisma.payout.update({ where: { id: payoutId }, data: { status: "paid", stripeTransferId: transfer.id } }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: "payout",
          text: `A$${requested.toFixed(2)} was sent to your connected Stripe account.`,
        },
      }),
    ]);
  } catch (err) {
    console.error("requestPayout: Stripe transfer failed, refunding claimed balance:", err);
    await prisma.$transaction([
      prisma.wallet.update({ where: { userId: user.id }, data: { balance: { increment: requested } } }),
      prisma.payout.update({ where: { id: payoutId }, data: { status: "failed" } }),
    ]);
    return { error: "The transfer failed — your balance has been restored. Please try again." };
  }

  revalidatePath("/author-dashboard");
  revalidatePath("/author-dashboard/payouts");
  return { ok: true };
}

export interface PayoutRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  stripeTransferId: string | null;
  createdAt: string;
}

/** All of the SIGNED-IN author's past withdrawals, newest first, plus a running total. */
export async function getPayoutHistory(): Promise<{ payouts: PayoutRecord[]; totalWithdrawn: number }> {
  const user = await requireAuthor();

  const rows = await prisma.payout.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const totalWithdrawn = rows
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    payouts: rows.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      stripeTransferId: p.stripeTransferId,
      createdAt: p.createdAt.toISOString(),
    })),
    totalWithdrawn: round2(totalWithdrawn),
  };
}
