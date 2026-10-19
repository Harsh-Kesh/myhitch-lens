import { NextResponse } from "next/server";

import { hubError, requireHubCompany, revokeInvite } from "@/lib/hubCompany";

/** DELETE /api/hub/company/invites/:id - cancels a pending invite (owner). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireHubCompany(request);
    await revokeInvite(ctx, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return hubError(e);
  }
}
