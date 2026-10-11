import { NextResponse } from "next/server";

import { addMember, hubError, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/company/members - a new author or editor sub-account (owner). */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    await addMember(ctx, await request.json().catch(() => ({})));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return hubError(e);
  }
}
