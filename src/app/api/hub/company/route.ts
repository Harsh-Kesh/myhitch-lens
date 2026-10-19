import { NextResponse } from "next/server";

import { hubError, overview, requireHubCompany, updateDetails } from "@/lib/hubCompany";

/** GET /api/hub/company - the company, your role and the team. */
export async function GET(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await overview(ctx));
  } catch (e) {
    return hubError(e);
  }
}

/** PATCH /api/hub/company - the company's name and ABN (owner). */
export async function PATCH(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    await updateDetails(ctx, await request.json().catch(() => ({})));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return hubError(e);
  }
}
