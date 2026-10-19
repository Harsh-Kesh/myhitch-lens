import { NextResponse } from "next/server";

import { deleteArticle, hubError, requireHubCompany, updateArticle } from "@/lib/hubCompany";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/hub/company/articles/:id - { title, content }; goes back to review. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await requireHubCompany(request);
    await updateArticle(ctx, (await params).id, await request.json().catch(() => ({})));
    return NextResponse.json({ ok: true, status: "in_review" });
  } catch (e) {
    return hubError(e);
  }
}

/** DELETE /api/hub/company/articles/:id - deleted, or taken down if it was published. */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const ctx = await requireHubCompany(request);
    const result = await deleteArticle(ctx, (await params).id);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return hubError(e);
  }
}
