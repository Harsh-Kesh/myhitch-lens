import { NextResponse } from "next/server";

import { aiError, rewrite } from "@/lib/hubAi";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/ai/rewrite - { text, action, instruction? } -> { text }. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await rewrite(ctx, await request.json().catch(() => ({}))));
  } catch (e) {
    return aiError(e);
  }
}
