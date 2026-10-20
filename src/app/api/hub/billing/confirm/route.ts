import { NextResponse } from "next/server";

import { billingError, confirmSubscription } from "@/lib/hubDashboard";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/billing/confirm - { subscriptionId } after the PaymentSheet -> the billing object. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await confirmSubscription(ctx, await request.json().catch(() => ({}))));
  } catch (e) {
    return billingError(e);
  }
}
