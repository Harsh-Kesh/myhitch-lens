import { NextResponse } from "next/server";

import { readNotification } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/notifications/:id/read */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireHubCompany(request);
    await readNotification(ctx, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return hubError(e);
  }
}
