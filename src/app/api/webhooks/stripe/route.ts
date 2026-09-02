import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { feeFor, round2 } from "@/lib/marketplace";

/** Stripe webhook: settles events into the ledger/wallet. Verified by signature, not auth. */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    if (checkoutSession.metadata?.kind === "donation") {
      await settleDonation(checkoutSession);
    }
  }

  return NextResponse.json({ received: true });
}

async function settleDonation(checkoutSession: Stripe.Checkout.Session) {
  const { articleId, authorId, donorId } = checkoutSession.metadata as {
    articleId: string;
    authorId: string;
    donorId: string;
  };

  // Stripe may redeliver the same event — skip if we've already booked this session.
  const existing = await prisma.revenueLedger.findFirst({
    where: { type: "donation", meta: { path: ["stripeSessionId"], equals: checkoutSession.id } },
  });
  if (existing) return;

  const gross = round2((checkoutSession.amount_total ?? 0) / 100);
  if (gross <= 0) return;
  const fee = feeFor("donation", gross);
  const net = round2(gross - fee);

  const donor = await prisma.user.findUnique({ where: { id: donorId }, select: { displayName: true } });
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { title: true } });

  await prisma.$transaction([
    prisma.revenueLedger.create({
      data: {
        userId: authorId,
        articleId,
        type: "donation",
        gross,
        feeApplied: fee,
        net,
        meta: { stripeSessionId: checkoutSession.id, donorId },
      },
    }),
    prisma.wallet.upsert({
      where: { userId: authorId },
      update: { balance: { increment: net } },
      create: { userId: authorId, balance: net },
    }),
    prisma.notification.create({
      data: {
        userId: authorId,
        type: "donation",
        text: `${donor?.displayName ?? "A reader"} sent $${gross.toFixed(2)} to support "${article?.title ?? "your article"}".`,
      },
    }),
  ]);
}
