import { NextResponse } from "next/server";
import { applyDecision, nexboardDenied } from "@/lib/nexboardReview";

const MAX_REASONS = 10;
const MAX_REASON = 300;

/**
 * MYHitch NexBoard's decision on one article (plan 13zj). Body { status: "approved" | "rejected", reasons: string[] }.
 * A rejection takes a published article down (back to changes_requested) and tells the writer; see lib/nexboardReview.ts.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = nexboardDenied(request);
  if (denied) return denied;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: unknown; reasons?: unknown } | null;
  const status = body?.status;
  if (status !== "approved" && status !== "rejected") return NextResponse.json({ error: 'status must be "approved" or "rejected".' }, { status: 400 });
  const reasons = (Array.isArray(body?.reasons) ? body.reasons : [])
    .map((r) => String(r ?? "").trim().slice(0, MAX_REASON))
    .filter(Boolean)
    .slice(0, MAX_REASONS);
  const result = await applyDecision(id, status, reasons);
  if (!result) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  return NextResponse.json({ ok: true, articleId: id, status, ...result });
}
