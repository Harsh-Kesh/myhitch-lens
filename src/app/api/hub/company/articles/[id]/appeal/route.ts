import { NextResponse } from "next/server";

import { fileAppeal } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/company/articles/:id/appeal - your own article: { kind: "editorial", reason, justify } or { kind: "takedown", text } -> 201 { id }. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireHubCompany(request);
    const id = await fileAppeal(ctx, (await params).id, await request.json().catch(() => ({})));
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return hubError(e);
  }
}
