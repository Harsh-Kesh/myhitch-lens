import { NextResponse } from "next/server";

import { billingError, cancelPlan } from "@/lib/hubDashboard";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/billing/cancel - ends the plan at the close of the paid period -> the billing object. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await cancelPlan(ctx, true));
  } catch (e) {
    return billingError(e);
  }
}
