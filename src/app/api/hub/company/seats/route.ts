import { NextResponse } from "next/server";

import { hubError, requireHubCompany, setSeats } from "@/lib/hubCompany";

/** PUT /api/hub/company/seats - { extraSeats } on the owner's Lens Business plan -> { extraSeats, seatUsage }. */
export async function PUT(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await setSeats(ctx, await request.json().catch(() => ({}))));
  } catch (e) {
    return hubError(e);
  }
}
