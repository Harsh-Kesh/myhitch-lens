import { NextResponse } from "next/server";

import { billingError, subscribe } from "@/lib/hubDashboard";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/billing/subscribe - { plan, interval } -> { clientSecret, publishableKey, customerId, ephemeralKey, subscriptionId } for the PaymentSheet. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await subscribe(ctx, await request.json().catch(() => ({}))));
  } catch (e) {
    return billingError(e);
  }
}
