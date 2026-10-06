import "server-only";

import Stripe from "stripe";

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Lazily-constructed Stripe client. Throws if STRIPE_SECRET_KEY isn't set. */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

let portalClient: Stripe | null = null;

/**
 * Stripe client for the MYHitch Business PORTAL's platform, which owns every
 * author's/organizer's Connect account. Donations are charged ON those accounts
 * (direct charges) with this client. It is a different Stripe platform from the
 * one behind `getStripe()` above (Lens's own, being retired): a connected
 * account created on one platform cannot be charged with the other's key, so
 * the two clients must never be mixed or used as fallbacks for each other.
 *
 * Returns null when not configured; callers must then REFUSE the payment.
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

/** Base URL for building Stripe redirect targets — same var NextAuth uses. */
export function appBaseUrl(): string {
  return process.env.AUTH_URL || "http://localhost:3000";
}
