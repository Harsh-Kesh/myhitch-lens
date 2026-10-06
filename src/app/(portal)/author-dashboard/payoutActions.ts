"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveAuthorAccount } from "@/lib/authorPaymentAccount";
import { round2 } from "@/lib/marketplace";
import { isSuspended } from "@/lib/authGuards";

async function requireAuthor() {
  const session = await auth();
  if (!session?.user || session.user.role !== "author") throw new Error("Not authorized");
  if (await isSuspended(session.user.id)) throw new Error("Your account is suspended.");
  return session.user;
}

export interface ConnectStatus {
  /** False when the portal can't be reached, so we can't say either way. */
  configured: boolean;
  /** The author has a Stripe account in MYHitch Business. */
  connected: boolean;
  payoutsEnabled: boolean;
}

/**
 * Where the SIGNED-IN author's payout account currently stands.
 *
 * Stripe accounts are owned by the MYHitch Business portal; Lens never creates
 * one and never moves money to one. This reads the portal's record live and
 * only reports status. Deliberately takes no userId parameter — every exported
 * function in a "use server" file is a directly callable RPC endpoint, so the
 * target user must always come from the verified session.
 *
 * Setup and bank changes happen in MYHitch Business (see MonetizationPanel /
 * ProfileSettings, which link there). Withdrawals from the Lens wallet are no
 * longer available: `requestPayout` and `startStripeConnectOnboarding` were
 * removed with the move to portal-owned accounts.
 */
export async function getConnectStatus(): Promise<ConnectStatus> {
  const user = await requireAuthor();
  const account = await resolveAuthorAccount(user.id);

  if (!account.ok) {
    return account.reason === "unavailable"
      ? { configured: false, connected: false, payoutsEnabled: false }
      : { configured: true, connected: false, payoutsEnabled: false };
  }
  return { configured: true, connected: true, payoutsEnabled: account.payoutsEnabled };
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
