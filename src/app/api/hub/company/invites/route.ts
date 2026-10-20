import { NextResponse } from "next/server";

import { hubError, inviteMember, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/company/invites - { email, displayName, orgRole: author|editor } (owner) -> 201 { id }. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    const id = await inviteMember(ctx, await request.json().catch(() => ({})));
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return hubError(e);
  }
}
