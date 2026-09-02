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

/** Base URL for building Stripe redirect targets — same var NextAuth uses. */
export function appBaseUrl(): string {
  return process.env.AUTH_URL || "http://localhost:3000";
}
