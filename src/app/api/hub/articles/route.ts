import { NextResponse } from "next/server";

import { hubDenied } from "@/lib/hubAuth";
import { listPublicArticles } from "@/lib/hubArticles";

/** GET /api/hub/articles?limit=&offset=&org= - published public articles, newest first. */
export async function GET(request: Request) {
  const denied = hubDenied(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
  const offset = Math.min(Math.max(Number(url.searchParams.get("offset")) || 0, 0), 5000);
  const org = url.searchParams.get("org") ?? undefined;
  try {
    return NextResponse.json(await listPublicArticles({ limit, offset, orgId: org && /^[a-z0-9]{10,40}$/i.test(org) ? org : undefined }));
  } catch (e) {
    console.error("Lens hub articles:", e);
    return NextResponse.json({ error: "Could not load articles." }, { status: 500 });
  }
}
