import { NextResponse } from "next/server";

import { checkout } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/billing/checkout - { plan, interval } -> { url } of Lens's Stripe Checkout. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json({ url: await checkout(ctx, await request.json().catch(() => ({}))) });
  } catch (e) {
    return hubError(e);
  }
}
