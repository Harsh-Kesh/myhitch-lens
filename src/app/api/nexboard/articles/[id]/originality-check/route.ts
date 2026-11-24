import { NextResponse } from "next/server";
import { nexboardDenied, startOriginalityCheck } from "@/lib/nexboardReview";

/** Starts Lens's own originality scan for an article that never had one (plan 13zj), so NexBoard can decide on it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = nexboardDenied(request);
  if (denied) return denied;
  const { id } = await params;
  const result = await startOriginalityCheck(id);
  if (result === "missing") return NextResponse.json({ error: "Article not found." }, { status: 404 });
  return NextResponse.json({ ok: true, articleId: id, result });
}
