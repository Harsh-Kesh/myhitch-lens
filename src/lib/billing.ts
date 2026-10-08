import "server-only";

import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { appBaseUrl, getBillingStripe } from "@/lib/stripe";
import { isPlanCode, type BillingInterval, type PlanCode } from "@/lib/plans";
import { syncVerification } from "@/lib/verification";

/**
 * Lens plan billing on Lens's own Stripe account.
 *
 * The source of truth for what someone owns is Stripe's subscription, read back
 * from Stripe whenever we update our Subscription row (checkout success, webhook).
 * The plan and interval are derived from the subscription's PRICE (its lookup key
 * `lens_<plan>_<interval>`), never from anything the browser sent.
 */

export type PaidPlan = Exclude<PlanCode, "free">;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return isPlanCode(value) && value !== "free";
}

export function isInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "year";
}

export function priceLookupKey(plan: PaidPlan, interval: BillingInterval): string {
  return `lens_${plan}_${interval}`;
}

const LOOKUP_RE = /^lens_(creator|professional|business)_(month|year)$/;

function parseLookupKey(key: string | null | undefined): { plan: PaidPlan; interval: BillingInterval } | null {
  const match = key ? LOOKUP_RE.exec(key) : null;
  return match ? { plan: match[1] as PaidPlan, interval: match[2] as BillingInterval } : null;
}

function requireStripe(): Stripe {
  const stripe = getBillingStripe();
  if (!stripe) throw new BillingError("Billing isn't set up yet. Please try again later.");
  return stripe;
}

/** An error whose message is safe to show to the customer. */
export class BillingError extends Error {}

async function findPriceId(stripe: Stripe, plan: PaidPlan, interval: BillingInterval): Promise<string> {
  const prices = await stripe.prices.list({ lookup_keys: [priceLookupKey(plan, interval)], active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) throw new BillingError("This plan isn't available to purchase yet.");
  return price.id;
}

/** The customer's Stripe customer id, creating the customer (and our row) on first use. */
async function ensureCustomer(stripe: Stripe, userId: string): Promise<string> {
  const existing = await prisma.subscription.findUnique({ where: { userId }, select: { stripeCustomerId: true } });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true } });
  if (!user) throw new BillingError("Account not found.");
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.displayName,
    metadata: { lensUserId: userId },
  });
  await prisma.subscription.upsert({
    where: { userId },
    update: { stripeCustomerId: customer.id },
    create: { userId, stripeCustomerId: customer.id }, // plan "free", status "incomplete": grants nothing yet
  });
  return customer.id;
}

/** True when the user already holds a paid plan (so they should change it in the billing portal). */
export async function hasActivePaidPlan(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId }, select: { plan: true, status: true } });
  return !!sub && sub.plan !== "free" && (sub.status === "active" || sub.status === "past_due");
}

/** Create a Stripe Checkout Session for a plan and return its URL. */
export async function createCheckoutUrl(userId: string, plan: PaidPlan, interval: BillingInterval): Promise<string> {
  const stripe = requireStripe();
  const [priceId, customer] = await Promise.all([findPriceId(stripe, plan, interval), ensureCustomer(stripe, userId)]);

  const base = appBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    // This Stripe account has "Managed Payments" (Stripe as merchant of record) on by
    // default, which needs a product tax code on every product. Lens sells as itself,
    // so opt out per session. Whether to move to Managed Payments is a business/tax
    // decision to make deliberately, not something checkout should silently depend on.
    ...({ managed_payments: { enabled: false } } as Record<string, unknown>),
    metadata: { lensUserId: userId, plan, interval },
    subscription_data: { metadata: { lensUserId: userId, plan, interval } },
    success_url: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing`,
  });
  if (!session.url) throw new BillingError("Couldn't start checkout. Please try again.");
  return session.url;
}

function mapStatus(status: Stripe.Subscription.Status): "active" | "past_due" | "canceled" | "incomplete" {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "incomplete"; // incomplete, incomplete_expired, paused
  }
}

/**
 * Write a Stripe subscription into our Subscription row (idempotent; safe to run
 * from the success page and from webhooks in any order, because it always stores
 * the subscription's current state). Returns the Lens user id it belongs to.
 */
export async function syncSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const item = subscription.items.data[0];
  const parsed = parseLookupKey(item?.price.lookup_key);
  if (!parsed) return null; // not one of our plans

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId =
    subscription.metadata?.lensUserId ??
    (await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId }, select: { userId: true } }))?.userId;
  if (!userId) return null;

  // Where the period end lives depends on the Stripe API version.
  const periodEndSeconds =
    (item as unknown as { current_period_end?: number }).current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;

  const data = {
    plan: parsed.plan,
    interval: parsed.interval,
    status: mapStatus(subscription.status),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: item.price.id,
    currentPeriodEnd: periodEndSeconds ? new Date(periodEndSeconds * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
  await prisma.subscription.upsert({ where: { userId }, update: data, create: { userId, ...data } });

  // The plan may add or remove the Verified badge.
  await syncVerification(userId);
  return userId;
}

/** A canceled/ended subscription drops back to Free (we keep the row and its Stripe ids). */
export async function markSubscriptionEnded(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const row = await prisma.subscription.findFirst({
    where: { OR: [{ stripeSubscriptionId: subscription.id }, { stripeCustomerId: customerId }] },
    select: { userId: true, stripeSubscriptionId: true },
  });
  // Ignore an old subscription ending after the customer already moved to a new one.
  if (!row || (row.stripeSubscriptionId && row.stripeSubscriptionId !== subscription.id)) return;
  await prisma.subscription.update({
    where: { userId: row.userId },
    data: { plan: "free", status: "canceled", cancelAtPeriodEnd: false, interval: null, extraSeats: 0 },
  });
  await syncVerification(row.userId);
}

/**
 * Activate the plan for a completed Checkout Session. Used by the success page.
 * The session must belong to THIS user, and must have produced a paid subscription.
 */
export async function activateFromCheckoutSession(sessionId: string, userId: string): Promise<PaidPlan> {
  const stripe = requireStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });

  if (session.client_reference_id !== userId) throw new BillingError("This checkout belongs to a different account.");
  if (session.mode !== "subscription" || !session.subscription || typeof session.subscription === "string") {
    throw new BillingError("This checkout has no subscription.");
  }
  if (session.status !== "complete") throw new BillingError("This checkout wasn't completed.");

  await syncSubscription(session.subscription);
  const row = await prisma.subscription.findUnique({ where: { userId }, select: { plan: true } });
  if (!row || row.plan === "free") throw new BillingError("We couldn't activate your plan yet. Please contact support.");
  return row.plan as PaidPlan;
}

/** Find (or create once) the Stripe Billing Portal configuration Lens uses. */
async function portalConfigurationId(stripe: Stripe): Promise<string> {
  const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 20 });
  const ours = configs.data.find((c) => c.metadata?.app === "lens");
  if (ours) return ours.id;

  const products: { product: string; prices: string[] }[] = [];
  for (const plan of ["creator", "professional", "business"] as const) {
    const prices = await stripe.prices.list({
      lookup_keys: [priceLookupKey(plan, "month"), priceLookupKey(plan, "year")],
      active: true,
    });
    if (prices.data.length) {
      products.push({ product: String(prices.data[0].product), prices: prices.data.map((p) => p.id) });
    }
  }

  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Manage your MYHitch Lens plan" },
    default_return_url: `${appBaseUrl()}/billing`,
    metadata: { app: "lens" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "name", "address"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: products.length > 0,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        ...(products.length > 0 ? { products } : {}),
      },
    },
  });
  return created.id;
}

/** URL of a Stripe Billing Portal session for this customer. */
export async function createPortalUrl(userId: string): Promise<string> {
  const stripe = requireStripe();
  const row = await prisma.subscription.findUnique({ where: { userId }, select: { stripeCustomerId: true } });
  if (!row?.stripeCustomerId) throw new BillingError("You don't have a billing account yet.");
  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    configuration: await portalConfigurationId(stripe),
    return_url: `${appBaseUrl()}/billing`,
  });
  return session.url;
}

