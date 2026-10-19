import { NextResponse } from "next/server";

import { hubError, overview, requireHubCompany, updateDetails } from "@/lib/hubCompany";

/** GET /api/hub/company - the company, your role, the team, seats and pending invites. */
export async function GET(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await overview(ctx));
  } catch (e) {
    return hubError(e);
  }
}

/** PATCH /api/hub/company - refused (403): the name and ABN come from MYHitch Business. */
export async function PATCH(request: Request) {
  try {
    await requireHubCompany(request);
    updateDetails();
  } catch (e) {
    return hubError(e);
  }
}
