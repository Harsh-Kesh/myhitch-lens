import { NextResponse } from "next/server";

import { notifications } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** GET /api/hub/notifications - your latest 50 notifications. */
export async function GET(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await notifications(ctx));
  } catch (e) {
    return hubError(e);
  }
}
