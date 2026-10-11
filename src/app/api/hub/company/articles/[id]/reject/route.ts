import { NextResponse } from "next/server";

import { hubError, rejectArticle, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/company/articles/:id/reject - { reason }. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireHubCompany(request);
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    await rejectArticle(ctx, (await params).id, body.reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return hubError(e);
  }
}
