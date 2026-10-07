import { NextResponse } from "next/server";

import { approveArticle, hubError, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/company/articles/:id/approve - publishes it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireHubCompany(request);
    await approveArticle(ctx, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return hubError(e);
  }
}
