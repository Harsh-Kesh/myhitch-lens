import { NextResponse } from "next/server";

import { aiError, languages } from "@/lib/hubAi";
import { requireHubCompany } from "@/lib/hubCompany";

/** GET /api/hub/ai/languages -> { languages: [{ code, label }] } for translate. */
export async function GET(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await languages(ctx));
  } catch (e) {
    return aiError(e);
  }
}
