import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { failReview, finishReview } from "@/lib/articleReview";
import { prisma } from "@/lib/prisma";

/**
 * Copyleaks status webhook for an article review: /api/copyleaks/webhook/{scanId}/{STATUS}.
 *
 * Copyleaks doesn't sign its calls, so the review's random secret, sent when the scan was submitted, comes
 * back in the body as `developerPayload` and must match. The scanId in the URL is the ArticleReview id.
 */
export async function POST(request: Request, ctx: { params: Promise<{ scanId: string; status: string }> }) {
  const { scanId, status } = await ctx.params;

  let body: {
    developerPayload?: string;
    results?: { score?: { aggregatedScore?: number } };
    error?: { message?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const review = await prisma.articleReview.findUnique({ where: { id: scanId }, select: { secret: true } });
  if (!review) return NextResponse.json({ ok: true, ignored: "unknown_scan" }); // 200, so Copyleaks doesn't keep retrying

  const sent = Buffer.from(typeof body.developerPayload === "string" ? body.developerPayload : "");
  const expected = Buffer.from(review.secret);
  if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) {
    return NextResponse.json({ error: "invalid_secret" }, { status: 401 });
  }

  if (status === "completed") {
    const score = body.results?.score?.aggregatedScore;
    if (typeof score !== "number" || !Number.isFinite(score)) {
      await failReview(scanId, "Copyleaks finished the scan without a similarity score.");
    } else {
      await finishReview(scanId, Math.round(score * 10) / 10);
    }
  } else if (status === "error") {
    await failReview(scanId, body.error?.message ?? "Copyleaks could not scan this article.");
  }
  // creditschecked / indexed need no action.

  return NextResponse.json({ ok: true });
}
