import { NextResponse } from "next/server";

import { aiError, translate } from "@/lib/hubAi";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/company/articles/:id/translate - { language } -> { title, text } (published articles). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await translate(ctx, (await params).id, await request.json().catch(() => ({}))));
  } catch (e) {
    return aiError(e);
  }
}
