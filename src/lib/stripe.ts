import "server-only";

import Stripe from "stripe";

let billingClient: Stripe | null = null;

/**
 * Stripe client for LENS'S OWN account, used only to bill Lens subscriptions
 * (the paid plans: Checkout, the Billing Portal and the billing webhook). It is
 * a different Stripe platform from the portal's author-payout accounts below:
 * never use one client for the other's job.
 */
export function getBillingStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return (billingClient ??= new Stripe(key));
}

/** Public base URL of this deployment, for Stripe redirect targets. */
export function appBaseUrl(): string {
  return process.env.AUTH_URL || "http://localhost:3001";
}

let portalClient: Stripe | null = null;

/**
 * Stripe client for the MYHitch Business PORTAL's platform, which owns every
 * author's Connect account. Lens takes no card payments for authors today, so
 * nothing calls this yet; it exists for read-only uses such as showing an
 * author's live balance (pass `connectedAccountOptions(accountId)`) and for any
 * future direct charges. A connected account belongs to one platform and cannot
 * be used with another platform's key, so never substitute `getBillingStripe()`
 * (Lens's own account, for plan subscriptions) as a fallback.
 *
 * Returns null when not configured; callers must then refuse to proceed.
 */
export function getPortalStripe(): Stripe | null {
  const key = process.env.PORTAL_STRIPE_SECRET_KEY;
  if (!key) return null;
  return (portalClient ??= new Stripe(key));
}

/** Request options that make a call act on a connected account (a direct charge). */
export function connectedAccountOptions(stripeAccountId: string) {
  return stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;
}
