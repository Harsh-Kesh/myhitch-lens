import { NextResponse } from "next/server";

import { billingError, cancelPlan } from "@/lib/hubDashboard";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/billing/resume - keeps a plan set to end -> the billing object. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await cancelPlan(ctx, false));
  } catch (e) {
    return billingError(e);
  }
}
