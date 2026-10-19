import { NextResponse } from "next/server";

import { billing } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** GET /api/hub/billing - your plan, its billing and the plans on offer. */
export async function GET(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await billing(ctx));
  } catch (e) {
    return hubError(e);
  }
}
