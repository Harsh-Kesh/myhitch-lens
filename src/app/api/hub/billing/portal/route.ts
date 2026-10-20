import { NextResponse } from "next/server";

import { portal } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/billing/portal -> { url } of the Stripe billing portal. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json({ url: await portal(ctx) });
  } catch (e) {
    return hubError(e);
  }
}
