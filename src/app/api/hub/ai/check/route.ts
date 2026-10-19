import { NextResponse } from "next/server";

import { aiError, check } from "@/lib/hubAi";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/ai/check - { title, content } (plain text) -> { summary, issues, truncated }. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await check(ctx, await request.json().catch(() => ({}))));
  } catch (e) {
    return aiError(e);
  }
}
