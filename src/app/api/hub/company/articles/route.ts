import { NextResponse } from "next/server";

import { createArticle, hubError, listArticles, requireHubCompany } from "@/lib/hubCompany";

/** GET /api/hub/company/articles - the company's articles (all statuses). */
export async function GET(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json({ articles: await listArticles(ctx) });
  } catch (e) {
    return hubError(e);
  }
}

/**
 * POST /api/hub/company/articles - { title, content (plain text), category?, type?, summary?, tags? };
 * goes to review. reviewers = how many others can approve it (0: invite an editor first).
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    const { id, reviewers } = await createArticle(ctx, await request.json().catch(() => ({})));
    return NextResponse.json({ id, status: "in_review", reviewers }, { status: 201 });
  } catch (e) {
    return hubError(e);
  }
}
