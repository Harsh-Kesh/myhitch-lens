import { NextResponse } from "next/server";

import { hubError, removeMember, requireHubCompany } from "@/lib/hubCompany";

/** DELETE /api/hub/company/members/:userId - revokes a sub-account's access (owner). */
export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await requireHubCompany(request);
    await removeMember(ctx, (await params).userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return hubError(e);
  }
}
