import { NextResponse } from "next/server";

import { aiError, titleAndExcerpt } from "@/lib/hubAi";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/ai/title - { title, content } -> { titles, excerpt }. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await titleAndExcerpt(ctx, await request.json().catch(() => ({}))));
  } catch (e) {
    return aiError(e);
  }
}
