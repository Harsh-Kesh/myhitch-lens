import { NextResponse } from "next/server";

import { hubError, requireHubCompany, reviewQueue } from "@/lib/hubCompany";

/** GET /api/hub/company/review - articles waiting for the company's review. */
export async function GET(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json({ articles: await reviewQueue(ctx) });
  } catch (e) {
    return hubError(e);
  }
}
