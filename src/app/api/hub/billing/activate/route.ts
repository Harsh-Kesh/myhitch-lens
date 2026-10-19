import { NextResponse } from "next/server";

import { activate } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/billing/activate - { sessionId } of a completed checkout -> the billing object. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await activate(ctx, await request.json().catch(() => ({}))));
  } catch (e) {
    return hubError(e);
  }
}
