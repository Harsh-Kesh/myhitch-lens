import "server-only";

import type Stripe from "stripe";

import {
  BillingError,
  ensureCustomer,
  findPriceId,
  hasActivePaidPlan,
  isInterval,
  isPaidPlan,
  parseLookupKey,
  priceIdByKey,
  requireStripe,
  SEAT_RE,
  seatLookupKey,
  syncSubscription,
} from "@/lib/billing";
import { getBillingStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * Lens plans bought and managed inside the MYHitch app with Stripe's native
 * PaymentSheet, instead of the web Checkout and Billing Portal. Same Stripe
 * account, prices (`lens_<plan>_<interval>`) and Subscription row as
 * src/lib/billing.ts: a subscription made here carries the same metadata as a
 * checkout one, so syncSubscription and the billing webhook treat it the same.
 */

/** The Stripe API version the app's PaymentSheet SDK expects for ephemeral keys. */
export const PAYMENT_SHEET_API_VERSION = "2024-06-20";

/** A refusal with the HTTP status (and extra JSON) the hub answers with. */
export class InAppBillingError extends BillingError {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export type PaymentSheetKeys = { publishableKey: string; customerId: string; ephemeralKey: string };

/** Lens's publishable key; without it the app can't show the PaymentSheet. */
function publishableKey(): string {
  const key = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  if (!key) {
    throw new InAppBillingError(503, "Paying in the app isn't switched on yet.", { code: "billing_not_configured" });
  }
  return key;
}

function stripeOrRefuse(): Stripe {
  publishableKey();
  return requireStripe();
}

async function sheetKeys(stripe: Stripe, customerId: string): Promise<PaymentSheetKeys> {
  const key = await stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: PAYMENT_SHEET_API_VERSION });
  if (!key.secret) throw new BillingError("Couldn't start the payment. Please try again.");
  return { publishableKey: publishableKey(), customerId, ephemeralKey: key.secret };
}

/**
 * The client secret of an invoice's payment: `confirmation_secret` on the API
 * version Lens's Stripe SDK pins, or the classic `payment_intent` on older ones.
 */
function invoiceClientSecret(invoice: Stripe.Invoice | string | null | undefined): string | null {
  if (!invoice || typeof invoice === "string") return null;
  const secret = invoice.confirmation_secret?.client_secret;
  if (secret) return secret;
  const classic = (invoice as unknown as { payment_intent?: { client_secret?: string | null } | string | null }).payment_intent;
  return classic && typeof classic === "object" ? (classic.client_secret ?? null) : null;
}

async function refuseStaff(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw new InAppBillingError(401, "Account not found.");
  if (user.role === "editor" || user.role === "admin") throw new InAppBillingError(403, "Staff accounts don't need a plan.");
}

function validPlan(plan: unknown, interval: unknown) {
  if (!isPaidPlan(plan) || !isInterval(interval)) throw new InAppBillingError(400, "Choose a valid plan.");
  return { plan, interval };
}

/** Our Subscription row's Stripe ids, for a user who pays through Stripe. */
async function paidRow(userId: string) {
  const row = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true, stripeSubscriptionId: true },
  });
  if (!(await hasActivePaidPlan(userId)) || !row?.stripeSubscriptionId || !row.stripeCustomerId) {
    throw new InAppBillingError(409, "You don't have a paid plan to change. Choose a plan first.");
  }
  return { customerId: row.stripeCustomerId, subscriptionId: row.stripeSubscriptionId };
}

// ---------------------------------------------------------------------------
// Buying a plan
// ---------------------------------------------------------------------------

/**
 * A new subscription waiting for its first payment, and what the PaymentSheet
 * needs to take it. Same refusals as checkout: staff, and anyone already paying
 * (they change plan instead).
 */
export async function createInAppSubscription(
  userId: string,
  planInput: unknown,
  intervalInput: unknown,
): Promise<PaymentSheetKeys & { clientSecret: string; subscriptionId: string }> {
  const { plan, interval } = validPlan(planInput, intervalInput);
  const stripe = stripeOrRefuse();
  await refuseStaff(userId);
  if (await hasActivePaidPlan(userId)) {
    throw new InAppBillingError(409, "You already have a paid plan. Use Manage billing to change or cancel it.");
  }

  const [priceId, customer] = await Promise.all([findPriceId(stripe, plan, interval), ensureCustomer(stripe, userId)]);

  // An earlier attempt the person never paid would otherwise sit there, so end it first.
  const unpaid = await stripe.subscriptions.list({ customer, status: "incomplete", limit: 10 });
  for (const old of unpaid.data) {
    if (old.metadata?.lensUserId === userId) await stripe.subscriptions.cancel(old.id).catch(() => undefined);
  }

  const subscription = await stripe.subscriptions.create({
    customer,
    items: [{ price: priceId, quantity: 1 }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: { lensUserId: userId, plan, interval, source: "app" },
    expand: ["latest_invoice.confirmation_secret"],
  });
  const clientSecret = invoiceClientSecret(subscription.latest_invoice);
  if (!clientSecret) throw new BillingError("Couldn't start the payment. Please try again.");

  return { clientSecret, subscriptionId: subscription.id, ...(await sheetKeys(stripe, customer)) };
}

/** After the PaymentSheet: read the subscription back into our row (the webhook does the same, later). */
export async function confirmInAppSubscription(userId: string, subscriptionIdInput: unknown): Promise<void> {
  const subscriptionId = String(subscriptionIdInput ?? "").trim();
  if (!/^sub_[A-Za-z0-9_]+$/.test(subscriptionId)) throw new InAppBillingError(400, "That subscription isn't valid.");
  const stripe = requireStripe();

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    if ((error as { code?: string }).code === "resource_missing") throw new InAppBillingError(404, "Subscription not found.");
    throw error;
  }
  const row = await prisma.subscription.findUnique({ where: { userId }, select: { stripeCustomerId: true } });
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (!row?.stripeCustomerId || row.stripeCustomerId !== customerId || subscription.metadata?.lensUserId !== userId) {
    throw new InAppBillingError(403, "This subscription belongs to a different account.");
  }
  await syncSubscription(subscription);
}

// ---------------------------------------------------------------------------
// Managing a plan (what the Billing Portal does on the web)
// ---------------------------------------------------------------------------

/**
 * Switch a paying customer to another plan or interval, as the portal's plan
 * switch does: the plan's price is swapped, Business's extra-user item is kept
 * (on the new interval's price) only when the new plan is Business, and the
 * difference is invoiced now and charged to the saved card. If the bank wants
 * the customer to confirm, the change waits and a 402 carries what the
 * PaymentSheet needs to finish it.
 */
export async function changeInAppPlan(userId: string, planInput: unknown, intervalInput: unknown): Promise<void> {
  const { plan, interval } = validPlan(planInput, intervalInput);
  const stripe = stripeOrRefuse();
  await refuseStaff(userId);
  const { customerId, subscriptionId } = await paidRow(userId);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const planItem = subscription.items.data.find((i) => parseLookupKey(i.price.lookup_key));
  const current = parseLookupKey(planItem?.price.lookup_key);
  if (!planItem || !current) throw new BillingError("We couldn't find your plan in billing. Please contact support.");
  if (current.plan === plan && current.interval === interval) throw new InAppBillingError(400, "You're already on this plan.");

  const items: Stripe.SubscriptionUpdateParams.Item[] = [{ id: planItem.id, price: await findPriceId(stripe, plan, interval) }];
  const seatItems = subscription.items.data.filter((i) => SEAT_RE.test(i.price.lookup_key ?? ""));
  if (seatItems.length > 0) {
    const seatPrice = plan === "business" ? await priceIdByKey(stripe, seatLookupKey(interval)) : null;
    for (const seat of seatItems) {
      items.push(seatPrice ? { id: seat.id, price: seatPrice } : { id: seat.id, deleted: true });
    }
  }

  let updated: Stripe.Subscription;
  try {
    updated = await stripe.subscriptions.update(subscriptionId, {
      items,
      proration_behavior: "always_invoice",
      // A payment that fails or needs the customer leaves the change pending instead of applied.
      payment_behavior: "pending_if_incomplete",
      expand: ["latest_invoice.confirmation_secret"],
    });
  } catch (error) {
    if ((error as { type?: string }).type === "StripeCardError") {
      throw await needsCustomer(stripe, customerId, subscriptionId, (error as Error).message);
    }
    throw error;
  }

  if (updated.pending_update) {
    throw await needsCustomer(stripe, customerId, subscriptionId, "Your bank needs you to confirm this payment.", updated.latest_invoice);
  }
  await syncSubscription(updated);
}

async function needsCustomer(
  stripe: Stripe,
  customerId: string,
  subscriptionId: string,
  message: string,
  invoice?: Stripe.Subscription["latest_invoice"],
): Promise<InAppBillingError> {
  let clientSecret = invoiceClientSecret(invoice);
  if (!clientSecret) {
    const again = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice.confirmation_secret"] });
    clientSecret = invoiceClientSecret(again.latest_invoice);
  }
  return new InAppBillingError(402, message || "The payment didn't go through.", {
    clientSecret,
    ...(await sheetKeys(stripe, customerId)),
  });
}

/** Cancel at the end of the paid period (true), or keep the plan going again (false). */
export async function setCancelAtPeriodEnd(userId: string, cancel: boolean): Promise<void> {
  const stripe = requireStripe();
  const { subscriptionId } = await paidRow(userId);
  const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: cancel });
  await syncSubscription(updated);
}

/** The card (or wallet) Stripe charges for renewals, when there is one. Never throws. */
export async function defaultPaymentMethod(userId: string): Promise<{ brand: string; last4: string } | null> {
  const stripe = getBillingStripe();
  if (!stripe) return null;
  const row = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true, stripeSubscriptionId: true },
  });
  if (!row?.stripeCustomerId) return null;
  const card = (pm: string | Stripe.PaymentMethod | null | undefined) =>
    pm && typeof pm !== "string" && pm.card ? { brand: pm.card.brand, last4: pm.card.last4 } : null;
  try {
    const customer = await stripe.customers.retrieve(row.stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (customer.deleted) return null;
    const fromCustomer = card(customer.invoice_settings?.default_payment_method);
    if (fromCustomer || !row.stripeSubscriptionId) return fromCustomer;
    // A card saved by a PaymentSheet purchase is the subscription's own default.
    const subscription = await stripe.subscriptions.retrieve(row.stripeSubscriptionId, {
      expand: ["default_payment_method"],
    });
    return card(subscription.default_payment_method);
  } catch (error) {
    console.error("[billing] default payment method lookup failed", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
