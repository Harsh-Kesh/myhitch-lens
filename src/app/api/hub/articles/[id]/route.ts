import { NextResponse } from "next/server";

import { hubDenied } from "@/lib/hubAuth";
import { publicArticle } from "@/lib/hubArticles";

/** GET /api/hub/articles/:id - a published public article (by id or slug). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = hubDenied(request);
  if (denied) return denied;
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const article = await publicArticle(id);
    return article ? NextResponse.json(article) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    console.error("Lens hub article:", e);
    return NextResponse.json({ error: "Could not load the article." }, { status: 500 });
  }
}
