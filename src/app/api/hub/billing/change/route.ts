import { NextResponse } from "next/server";

import { billingError, changePlan } from "@/lib/hubDashboard";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/billing/change - { plan, interval } for someone already paying -> the billing object (402 with PaymentSheet keys if the bank needs them). */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await changePlan(ctx, await request.json().catch(() => ({}))));
  } catch (e) {
    return billingError(e);
  }
}
