import { NextResponse } from "next/server";

import { appeals } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** GET /api/hub/appeals - your appeals on your own articles. */
export async function GET(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await appeals(ctx));
  } catch (e) {
    return hubError(e);
  }
}
