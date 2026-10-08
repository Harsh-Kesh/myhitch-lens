import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { markSubscriptionEnded, syncSubscription } from "@/lib/billing";
import { getBillingStripe } from "@/lib/stripe";

/**
 * Stripe webhook for Lens plan subscriptions (Lens's own Stripe account).
 *
 * It keeps our Subscription row in step with Stripe for everything that happens
 * after checkout: renewals, plan changes and cancellations made in the billing
 * portal, failed payments. Every handler re-reads the subscription from Stripe
 * and writes its CURRENT state, so redelivered or out-of-order events are safe.
 *
 * Verified by Stripe's signature over the raw body, with this endpoint's own
 * signing secret (STRIPE_BILLING_WEBHOOK_SECRET), not by a login.
 */
export async function POST(request: Request) {
  const stripe = getBillingStripe();
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !secret) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  if (!signature) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          await syncSubscription(await stripe.subscriptions.retrieve(id));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(await stripe.subscriptions.retrieve(sub.id));
        break;
      }
      case "customer.subscription.deleted": {
        await markSubscriptionEnded(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_failed":
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
        const ref = invoice.subscription;
        if (ref) {
          const id = typeof ref === "string" ? ref : ref.id;
          await syncSubscription(await stripe.subscriptions.retrieve(id));
        }
        break;
      }
      default:
        break; // other events are not needed
    }
  } catch (error) {
    // A transient failure (database, Stripe) must be retried: respond 500.
    console.error("[billing-webhook] handler failed", {
      type: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
