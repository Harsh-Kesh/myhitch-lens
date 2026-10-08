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

/** A subscription whose paid period ended more than this long ago no longer grants access. */
const PERIOD_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

function grantsAccess(sub: { status: string; currentPeriodEnd: Date | null }): boolean {
  if (!ACCESS_STATUSES.has(sub.status)) return false;
  // Even if a webhook hasn't marked it canceled yet, an expired period grants nothing.
  return !sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() >= Date.now() - PERIOD_GRACE_MS;
}

export async function getPlanCode(userId: string): Promise<PlanCode> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  if (!sub || !grantsAccess(sub)) return "free";
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

/**
 * Of these authors, the ones whose plan includes priority editorial review
 * (Professional and above). One query for the whole list, so the review queue
 * can be ordered without a lookup per article.
 */
export async function priorityAuthorIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const priorityPlans = Object.values(PLANS)
    .filter((p) => p.entitlements.priorityReview)
    .map((p) => p.code);
  const rows = await prisma.subscription.findMany({
    where: { userId: { in: userIds }, plan: { in: priorityPlans }, status: { in: ["active", "past_due"] } },
    select: { userId: true, status: true, currentPeriodEnd: true },
  });
  return new Set(rows.filter(grantsAccess).map((r) => r.userId));
}
