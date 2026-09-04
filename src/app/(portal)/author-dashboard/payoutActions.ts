"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import { CURRENCY, MARKETPLACE_DEFAULTS } from "@/lib/platformConfig";
import { round2 } from "@/lib/marketplace";

async function requireAuthor() {
  const session = await auth();
  if (!session?.user || session.user.role !== "author") throw new Error("Not authorized");
  return session.user;
}

export interface ConnectStatus {
  configured: boolean;
  connected: boolean;
  payoutsEnabled: boolean;
}

/** Where the author's Stripe Connect account currently stands. */
export async function getConnectStatus(userId: string): Promise<ConnectStatus> {
  if (!isStripeConfigured()) return { configured: false, connected: false, payoutsEnabled: false };

  const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { stripeConnectId: true } });
  if (!wallet?.stripeConnectId) return { configured: true, connected: false, payoutsEnabled: false };

  try {
    const account = await getStripe().accounts.retrieve(wallet.stripeConnectId);
    return { configured: true, connected: true, payoutsEnabled: !!account.payouts_enabled };
  } catch {
    // The stored account id no longer resolves (e.g. deleted in the Stripe
    // dashboard) — treat as not connected rather than failing the page.
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
}

/**
 * Transfers the author's full wallet balance to their connected Stripe
 * account. Stripe's own transfer/payout fee comes out of the connected
 * account, not the platform's — matching the "author bears the Stripe fee"
 * policy (see platformConfig.ts).
 */
export async function requestPayout(): Promise<{ error: string } | { ok: true }> {
  const user = await requireAuthor();
  if (!isStripeConfigured()) return { error: "Payouts aren't set up yet — check back soon." };

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet?.stripeConnectId) return { error: "Connect your Stripe account first." };

  const balance = round2(Number(wallet.balance));
  if (balance < MARKETPLACE_DEFAULTS.payoutMinimum) {
    return { error: `Minimum payout is A$${MARKETPLACE_DEFAULTS.payoutMinimum}.` };
  }

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(wallet.stripeConnectId);
  if (!account.payouts_enabled) {
    return { error: "Finish connecting your Stripe account before withdrawing." };
  }

  const transfer = await stripe.transfers.create({
    amount: Math.round(balance * 100),
    currency: CURRENCY.toLowerCase(),
    destination: wallet.stripeConnectId,
  });

  await prisma.$transaction([
    prisma.wallet.update({ where: { userId: user.id }, data: { balance: { decrement: balance } } }),
    prisma.payout.create({
      data: {
        userId: user.id,
        amount: balance,
        currency: CURRENCY,
        status: "paid",
        stripeTransferId: transfer.id,
      },
    }),
    prisma.notification.create({
      data: {
        userId: user.id,
        type: "payout",
        text: `A$${balance.toFixed(2)} was sent to your connected Stripe account.`,
      },
    }),
  ]);

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

/** All of the author's past withdrawals, newest first, plus a running total. */
export async function getPayoutHistory(userId: string): Promise<{ payouts: PayoutRecord[]; totalWithdrawn: number }> {
  const rows = await prisma.payout.findMany({
    where: { userId },
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
