import { NextResponse } from "next/server";

import { readAllNotifications } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/notifications/read-all */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    await readAllNotifications(ctx);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return hubError(e);
  }
}
