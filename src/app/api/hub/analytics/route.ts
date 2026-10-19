import { NextResponse } from "next/server";

import { analytics } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** GET /api/hub/analytics - the whole team's analytics (locked below advanced analytics). */
export async function GET(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await analytics(ctx));
  } catch (e) {
    return hubError(e);
  }
}
