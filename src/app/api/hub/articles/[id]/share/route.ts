import { NextResponse } from "next/server";

import { countArticleShare } from "@/lib/articleStats";
import { hubDenied } from "@/lib/hubAuth";

/**
 * POST /api/hub/articles/:id/share - a share in the MYHitch app, counted as the
 * website counts one (src/lib/articleStats.ts). App readers aren't signed in
 * to Lens, so it counts like a signed-out reader's; the hub keeps one person
 * from counting the same article over and over.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = hubDenied(request);
  if (denied) return denied;
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json({ counted: await countArticleShare(id, null) });
  } catch (e) {
    console.error("Lens hub article share:", e);
    return NextResponse.json({ error: "Could not record that." }, { status: 500 });
  }
}
