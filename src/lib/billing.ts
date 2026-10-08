import "server-only";

import type Stripe from "stripe";

import { ownedOrganizationId } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, getBillingStripe } from "@/lib/stripe";
import { MAX_EXTRA_SEATS, PLANS, isPlanCode, type BillingInterval, type PlanCode } from "@/lib/plans";
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
const SEAT_RE = /^lens_business_extra_seat_(month|year)$/;

/** Price key of the "extra company user" add-on; it must bill on the plan's own interval. */
export function seatLookupKey(interval: BillingInterval): string {
  return `lens_business_extra_seat_${interval}`;
}

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

/**
 * True when the user pays for a plan through Stripe (so they should change it in the
 * billing portal). A plan switched on without payment (test mode, below) has no
 * Stripe subscription and does not count: it can still be replaced by buying one.
 */
export async function hasActivePaidPlan(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, stripeSubscriptionId: true },
  });
  return !!sub && !!sub.stripeSubscriptionId && sub.plan !== "free" && (sub.status === "active" || sub.status === "past_due");
}

/**
 * TEST MODE: let people switch plan without paying, to try each package's benefits.
 * Off unless ALLOW_FREE_PLAN_SWITCH=true, and refused outright when Stripe is in
 * live mode, so it cannot hand out paid plans on a real-money deployment even if
 * the flag is left on by mistake. Turn it off (and rely on checkout) to go live.
 */
export function freePlanSwitchEnabled(): boolean {
  if ((process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_")) return false;
  return process.env.ALLOW_FREE_PLAN_SWITCH === "true";
}

/** Put a user on any plan with no payment (only when test mode is on). Never touches a plan paid through Stripe. */
export async function switchPlanWithoutPayment(userId: string, plan: PlanCode): Promise<void> {
  if (!freePlanSwitchEnabled()) throw new BillingError("Switching plans without payment isn't enabled.");
  if (!isPlanCode(plan)) throw new BillingError("Choose a valid plan.");

  const current = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true, status: true },
  });
  if (current?.stripeSubscriptionId && (current.status === "active" || current.status === "past_due")) {
    throw new BillingError("You pay for your current plan through Stripe. Use Manage billing to change or cancel it.");
  }
  if (plan === "business" && !(await ownedOrganizationId(userId))) {
    throw new BillingError("Lens Business is for company accounts. Register your business with MYHitch first.");
  }

  const data = {
    plan,
    status: "active" as const,
    interval: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodEnd: null, // no payment, so no paid period to run out
    cancelAtPeriodEnd: false,
    extraSeats: 0,
  };
  await prisma.subscription.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  console.info("[billing] plan switched without payment", { userId, plan });
  await syncVerification(userId); // the plan may add or remove the Verified badge
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
  // A Business subscription can carry two items: the plan and the extra-users add-on.
  const item = subscription.items.data.find((i) => parseLookupKey(i.price.lookup_key));
  const parsed = parseLookupKey(item?.price.lookup_key);
  if (!item || !parsed) return null; // not one of our plans
  const seatItem = subscription.items.data.find((i) => SEAT_RE.test(i.price.lookup_key ?? ""));

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
    extraSeats: parsed.plan === "business" ? (seatItem?.quantity ?? 0) : 0,
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


/**
 * Set how many extra company users the owner pays for (Business plan). Changes the
 * live Stripe subscription (prorated), then reads it back so our row matches.
 * Refuses to go below the seats already in use.
 */
export async function setExtraSeats(userId: string, count: number): Promise<void> {
  if (!Number.isInteger(count) || count < 0 || count > MAX_EXTRA_SEATS) {
    throw new BillingError(`Choose between 0 and ${MAX_EXTRA_SEATS} extra users.`);
  }
  const orgId = await ownedOrganizationId(userId);
  const row = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, interval: true, stripeSubscriptionId: true },
  });
  if (!orgId || !row || row.plan !== "business" || row.status !== "active" || !row.stripeSubscriptionId || !row.interval) {
    throw new BillingError("Extra users are part of an active Lens Business plan.");
  }

  const [members, pending] = await Promise.all([
    prisma.orgMembership.count({ where: { orgId } }),
    prisma.orgInvite.count({ where: { orgId, acceptedAt: null } }),
  ]);
  const minimum = Math.max(0, members + pending - PLANS.business.entitlements.includedSeats);
  if (count < minimum) {
    throw new BillingError(`${members + pending} seats are in use (members and pending invites). Remove some before reducing below ${minimum} extra.`);
  }

  const stripe = requireStripe();
  const seatPriceId = await priceIdByKey(stripe, seatLookupKey(row.interval));
  const subscription = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
  const existing = subscription.items.data.find((i) => i.price.id === seatPriceId);

  const items: Stripe.SubscriptionUpdateParams.Item[] = [];
  if (count === 0 && existing) items.push({ id: existing.id, deleted: true });
  else if (count > 0 && existing) items.push({ id: existing.id, quantity: count });
  else if (count > 0) items.push({ price: seatPriceId, quantity: count });
  if (items.length === 0) return; // nothing to change

  const updated = await stripe.subscriptions.update(subscription.id, { items, proration_behavior: "create_prorations" });
  await syncSubscription(updated);
}

async function priceIdByKey(stripe: Stripe, key: string): Promise<string> {
  const prices = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (!prices.data[0]) throw new BillingError("Extra users aren't available to purchase yet.");
  return prices.data[0].id;
}
