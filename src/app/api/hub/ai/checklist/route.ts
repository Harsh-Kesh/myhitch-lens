import { NextResponse } from "next/server";

import { aiError, checklist } from "@/lib/hubAi";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/ai/checklist - { title, content } -> { items }. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await checklist(ctx, await request.json().catch(() => ({}))));
  } catch (e) {
    return aiError(e);
  }
}
