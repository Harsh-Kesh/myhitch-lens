import "server-only";

import { createHash, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startReview } from "@/lib/articleReview";
import { isReviewStale } from "@/lib/reviewScoring";
import { coverOf } from "@/lib/hubCompany";
import { articleJsonToText } from "@/lib/writingCheck";
import { LEGAL_CHECKS, type LegalReview } from "@/lib/legalReviewTypes";

/**
 * MYHitch NexBoard's approval gate for Lens (NexBoard plan 13zj).
 *
 * NexBoard checks every published, public article: the writer's standing, rights, completeness, length, Lens's own originality
 * scan and legal check, and banned content. It posts each decision here:
 *  - rejected: the article goes back to changes_requested with the reasons as a revision note, and the writer is notified. It
 *    leaves every reader list (they all show only "published"), and NOT_REJECTED keeps it hidden even if it is published again
 *    unchanged. The writer fixes it, resubmits, publishes, and NexBoard checks it again.
 *  - approved: kept; the writer is told only when it undoes a rejection.
 */

function sameSecret(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/** A response refusing the call, or null when NexBoard's key (NEXBOARD_API_KEY) is right. */
export function nexboardDenied(request: Request): NextResponse | null {
  const expected = process.env.NEXBOARD_API_KEY;
  if (!expected) return NextResponse.json({ error: "NexBoard integration is not configured yet. Add NEXBOARD_API_KEY." }, { status: 501 });
  const given = request.headers.get("x-api-key") ?? "";
  if (!given || !sameSecret(given, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

const MAX_TEXT = 30_000;
const BLOCKING = LEGAL_CHECKS.filter((c) => c.id !== "standards").map((c) => c.id as string);

/** What the legal check found, when it ran: the blocking checks not marked clear. */
function legalOf(aiScores: unknown): { ran: boolean; flagged: { label: string; status: string; summary: string }[] } {
  const review = aiScores && typeof aiScores === "object" ? (aiScores as { legalReview?: LegalReview }).legalReview : undefined;
  if (!review || !review.available || !Array.isArray(review.checks)) return { ran: false, flagged: [] };
  return {
    ran: true,
    flagged: review.checks
      .filter((c) => BLOCKING.includes(c.id) && c.status !== "clear")
      .map((c) => ({ label: c.label, status: c.status, summary: c.summary })),
  };
}

/** Every published, public article, with what NexBoard's checks need. Rejected ones included, so NexBoard sees them change. */
export async function reviewQueue() {
  const rows = await prisma.article.findMany({
    where: { status: "published", lane: { in: ["public", "hybrid"] } },
    orderBy: { publishedAt: "desc" },
    take: 1000,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      content: true,
      contentType: true,
      lane: true,
      license: true,
      rightsAttested: true,
      aiScores: true,
      publishedAt: true,
      category: { select: { name: true } },
      _count: { select: { tags: true } },
      author: { select: { id: true, displayName: true, suspended: true, role: true } },
      articleReviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, state: true, passed: true, plagiarismPercent: true, aiPercent: true, maxPlagiarism: true, maxAi: true, error: true, createdAt: true },
      },
      nexboardReview: { select: { status: true, reviewedAt: true } },
    },
  });
  return rows.map((a) => {
    const text = (articleJsonToText(a.content) || a.content).trim();
    const review = a.articleReviews[0] ?? null;
    return {
      id: a.id,
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      contentType: a.contentType,
      lane: a.lane,
      category: a.category?.name ?? null,
      tags: a._count.tags,
      words: text ? text.split(/\s+/).length : 0,
      text: text.slice(0, MAX_TEXT),
      hasImage: coverOf(a.content) !== null,
      license: a.license,
      rightsAttested: a.rightsAttested,
      publishedAt: a.publishedAt?.toISOString() ?? null,
      writer: { id: a.author.id, name: a.author.displayName, suspended: a.author.suspended, role: a.author.role },
      originality: review
        ? {
            id: review.id,
            state: review.state,
            passed: review.passed,
            stale: review.state === "pending" && isReviewStale(review.createdAt),
            plagiarismPercent: review.plagiarismPercent,
            aiPercent: review.aiPercent,
            maxPlagiarism: review.maxPlagiarism,
            maxAi: review.maxAi,
            error: review.error,
            createdAt: review.createdAt.toISOString(),
          }
        : null,
      legal: legalOf(a.aiScores),
      nexboardReview: a.nexboardReview ? { status: a.nexboardReview.status, reviewedAt: a.nexboardReview.reviewedAt.toISOString() } : null,
    };
  });
}

function refreshViews() {
  for (const p of ["/explore", "/magazine", "/categories", "/author-dashboard", "/submit-article", "/editorial"]) revalidatePath(p);
}

/**
 * Applies NexBoard's decision. A rejection sends a published article back for changes with the reasons, and notifies the
 * writer once per change of decision. Returns the writer's MYHitch login id, so NexBoard can ask the hub to tell them in the app.
 */
export async function applyDecision(articleId: string, status: "approved" | "rejected", reasons: string[]) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      status: true,
      authorId: true,
      author: { select: { platformIdentity: { select: { myhitchId: true } } } },
      nexboardReview: { select: { notifiedStatus: true } },
    },
  });
  if (!article) return null;

  const told = article.nexboardReview?.notifiedStatus ?? null;
  const tell = told !== status && (status === "rejected" || told === "rejected");
  const why = reasons.length ? ` ${reasons.join(" ")}` : "";
  // only a published article is sent back: one the writer already took down or is editing stays where it is
  const sendBack = status === "rejected" && article.status === "published";
  const now = new Date();

  await prisma.$transaction([
    prisma.nexboardReview.upsert({
      where: { articleId },
      create: { articleId, status, reasons, reviewedAt: now, ...(tell ? { notifiedStatus: status, notifiedAt: now } : {}) },
      update: { status, reasons, reviewedAt: now, ...(tell ? { notifiedStatus: status, notifiedAt: now } : {}) },
    }),
    ...(sendBack
      ? [
          prisma.article.update({ where: { id: articleId }, data: { status: "changes_requested" } }),
          prisma.revision.create({
            data: { articleId, note: `[MYHitch review] Not approved, so it was taken down from Lens and the MYHitch app.${why} Fix this, then resubmit and publish it again.` },
          }),
        ]
      : []),
    ...(tell
      ? [
          prisma.notification.create({
            data: {
              userId: article.authorId,
              type: status === "rejected" ? "rejected" : "publish",
              text:
                status === "rejected"
                  ? `“${article.title}” wasn't approved by MYHitch, so readers and the MYHitch app can't see it.${why} Edit it in Submit Article, resubmit and publish it again.`
                  : article.status === "published"
                    ? `“${article.title}” is approved by MYHitch and visible again on Lens and in the MYHitch app.`
                    : `“${article.title}” is approved by MYHitch. Publish it again from Submit Article to make it visible.`,
            },
          }),
        ]
      : []),
  ]);
  refreshViews();
  return { notified: tell, sentBack: sendBack, writer: { myhitchId: article.author.platformIdentity?.myhitchId ?? null } };
}

/** Starts Lens's originality scan for an article that has none (older and company articles), unless one is already running. */
export async function startOriginalityCheck(articleId: string): Promise<"started" | "running" | "missing"> {
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true } });
  if (!article) return "missing";
  const latest = await prisma.articleReview.findFirst({ where: { articleId }, orderBy: { createdAt: "desc" }, select: { state: true, createdAt: true } });
  if (latest?.state === "pending" && !isReviewStale(latest.createdAt)) return "running";
  await startReview(articleId);
  return "started";
}
