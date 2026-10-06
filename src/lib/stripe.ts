import "server-only";

import Stripe from "stripe";

let portalClient: Stripe | null = null;

/**
 * Stripe client for the MYHitch Business PORTAL's platform, which owns every
 * author's Connect account. Lens takes no card payments today, so nothing calls
 * this yet; it exists for read-only uses such as showing an author's live
 * balance (pass `connectedAccountOptions(accountId)`) and for any future direct
 * charges. Lens's former own Stripe platform is retired: a connected account
 * belongs to one platform and cannot be used with another platform's key, so
 * never substitute a different key as a fallback.
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
