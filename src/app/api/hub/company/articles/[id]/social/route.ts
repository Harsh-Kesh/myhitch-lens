import { NextResponse } from "next/server";

import { aiError, socialPosts } from "@/lib/hubAi";
import { requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/company/articles/:id/social -> { linkedin, facebook, instagram, x } (published articles). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await socialPosts(ctx, (await params).id));
  } catch (e) {
    return aiError(e);
  }
}
