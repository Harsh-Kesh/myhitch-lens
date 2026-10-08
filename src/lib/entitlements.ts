import "server-only";

import { prisma } from "@/lib/prisma";
import { PLANS, isPlanCode, type PlanCode, type PlanDefinition, type PlanEntitlements } from "@/lib/plans";

/**
 * Server-side plan checks. Every gated action asks THIS module what the user's
 * plan allows; nothing trusts the browser or the pricing page.
 *
 * A user's plan is their active subscription's plan, otherwise "free". A
 * subscription grants its plan while it is `active`, or `past_due` (Stripe is
 * still retrying the payment; the customer keeps access meanwhile). Anything
 * else (canceled, incomplete) falls back to Free.
 */

const ACCESS_STATUSES = new Set(["active", "past_due"]);

export async function getPlanCode(userId: string): Promise<PlanCode> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  if (!sub || !ACCESS_STATUSES.has(sub.status)) return "free";
  // A subscription whose paid period has ended no longer grants access, even if
  // a webhook hasn't arrived to mark it canceled yet.
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now() - 3 * 24 * 60 * 60 * 1000) return "free";
  return isPlanCode(sub.plan) ? sub.plan : "free";
}

export async function getPlan(userId: string): Promise<PlanDefinition> {
  return PLANS[await getPlanCode(userId)];
}

export async function getEntitlements(userId: string): Promise<PlanEntitlements> {
  return (await getPlan(userId)).entitlements;
}

/** Start of the current calendar month (UTC). Submission allowances reset then. */
export function startOfCurrentMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Articles this author has submitted for review since the start of the month. */
export async function submissionsThisMonth(userId: string): Promise<number> {
  return prisma.article.count({
    where: { authorId: userId, submittedAt: { gte: startOfCurrentMonth() } },
  });
}

export interface SubmissionAllowance {
  limit: number | null;
  used: number;
  remaining: number | null;
  allowed: boolean;
}

export async function getSubmissionAllowance(userId: string): Promise<SubmissionAllowance> {
  const [{ monthlySubmissions: limit }, used] = await Promise.all([getEntitlements(userId), submissionsThisMonth(userId)]);
  const remaining = limit === null ? null : Math.max(0, limit - used);
  return { limit, used, remaining, allowed: remaining === null || remaining > 0 };
}

/** Standard wording for a refused action, with a pointer to upgrade. */
export function upgradeMessage(what: string): string {
  return `${what} Upgrade your plan on the Pricing page to unlock it.`;
}
