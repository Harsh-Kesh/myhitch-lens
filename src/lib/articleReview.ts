import "server-only";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { AI_DETECTOR_MIN_CHARS, copyleaksConfigured, detectAi, submitScan } from "@/lib/copyleaks";
import { prisma } from "@/lib/prisma";
import { getReviewConfig, judgeReview } from "@/lib/reviewScoring";
import { articleJsonToText } from "@/lib/writingCheck";

/** Where Copyleaks can reach this site. It cannot call localhost: use a tunnel URL when testing locally. */
function webhookBaseUrl(): string | null {
  const base = process.env.COPYLEAKS_WEBHOOK_BASE_URL || process.env.AUTH_URL;
  // Only the site address is wanted. If the whole webhook URL was pasted in, drop the route part so it isn't doubled.
  return base ? base.trim().replace(/\/api\/copyleaks.*$/i, "").replace(/\/+$/, "") : null;
}

function refreshViews() {
  revalidatePath("/submit-article");
  revalidatePath("/author-dashboard");
  revalidatePath("/editorial");
}

async function markError(reviewId: string, message: string) {
  await prisma.articleReview.updateMany({
    where: { id: reviewId, state: "pending" },
    data: { state: "error", error: message.slice(0, 300), completedAt: new Date() },
  });
  refreshViews();
}

/**
 * Start an automated review of a submitted article: run the AI-content check and send the text to Copyleaks
 * for a plagiarism scan. The scan's result arrives later at /api/copyleaks/webhook (see `finishReview`).
 * Never throws: a failure is recorded on the review so the author can run it again.
 */
export async function startReview(articleId: string): Promise<void> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { title: true, content: true },
  });
  if (!article) return;

  const review = await prisma.articleReview.create({
    data: { articleId, secret: randomBytes(24).toString("hex") },
    select: { id: true, secret: true },
  });

  try {
    if (!copyleaksConfigured()) throw new Error("The plagiarism checker isn't set up yet.");
    const base = webhookBaseUrl();
    if (!base) throw new Error("No public site URL is configured for the plagiarism checker's callback.");

    const body = articleJsonToText(article.content) || article.content;
    const text = `${article.title}\n\n${body}`;

    // The AI-content check is a bonus signal: if it can't run (e.g. the text is too short), the scan still goes ahead.
    let aiPercent: number | null = null;
    if (text.length >= AI_DETECTOR_MIN_CHARS) {
      try {
        aiPercent = await detectAi({ scanId: `ai-${review.id}`, text });
      } catch (err) {
        console.error("Copyleaks AI-content check failed:", err);
      }
    }
    if (aiPercent !== null) {
      await prisma.articleReview.update({ where: { id: review.id }, data: { aiPercent } });
    }

    await submitScan({ scanId: review.id, filename: "article.txt", text, secret: review.secret, webhookBaseUrl: base });
  } catch (err) {
    console.error("Starting the article review failed:", err);
    await markError(review.id, err instanceof Error ? err.message : "The review could not be started.");
  }
}

/**
 * Apply a finished plagiarism scan: judge plagiarism and AI-written text each against its own limit, record
 * the decision, and move the article on. It passes only if both are within their limit. A pass makes it
 * "approved" (the author can then publish it); a fail sends it back as "changes requested" with the reason
 * as the note. Only acts on the article's newest review, and only while the article is still in review, so a
 * late result for an older submission can't change it.
 */
export async function finishReview(reviewId: string, plagiarismPercent: number): Promise<void> {
  const review = await prisma.articleReview.findUnique({
    where: { id: reviewId },
    select: { id: true, state: true, articleId: true, aiPercent: true },
  });
  if (!review || review.state !== "pending") return; // unknown, or a redelivered webhook

  const config = getReviewConfig();
  const { plagiarismPassed, aiPassed, passed } = judgeReview({ plagiarismPercent, aiPercent: review.aiPercent }, config);

  const [latest, article] = await Promise.all([
    prisma.articleReview.findFirst({ where: { articleId: review.articleId }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    prisma.article.findUnique({ where: { id: review.articleId }, select: { status: true, title: true, authorId: true, aiScores: true } }),
  ]);

  const result = prisma.articleReview.update({
    where: { id: review.id },
    data: {
      state: "completed",
      plagiarismPercent,
      maxPlagiarism: config.maxPlagiarismPercent,
      maxAi: config.maxAiPercent,
      plagiarismPassed,
      aiPassed,
      passed,
      completedAt: new Date(),
    },
  });

  if (!article || latest?.id !== review.id || article.status !== "in_review") {
    await result;
    refreshViews();
    return;
  }

  // Say which check failed and by how much, so the author knows what to fix.
  const verdict = (label: string, value: number, limit: number, ok: boolean) =>
    `${label}: ${value}% (limit ${limit}%) — ${ok ? "within the limit" : "over the limit"}.`;
  const summary = [
    verdict("Plagiarism", plagiarismPercent, config.maxPlagiarismPercent, plagiarismPassed),
    review.aiPercent === null
      ? "AI-written text: not checked."
      : verdict("AI-written text", review.aiPercent, config.maxAiPercent, aiPassed !== false),
  ].join(" ");
  // The editor board's "AI Score" is higher-is-better: 100 minus the worse of the two percentages.
  const worst = Math.max(plagiarismPercent, review.aiPercent ?? 0);

  await prisma.$transaction([
    result,
    prisma.article.update({
      where: { id: review.articleId },
      data: {
        status: passed ? "approved" : "changes_requested",
        // Replace the placeholder numbers written at submission with the real ones; the editor board reads these.
        aiScores: {
          ...(article.aiScores && typeof article.aiScores === "object" && !Array.isArray(article.aiScores) ? article.aiScores : {}),
          aiScore: Math.round(100 - worst),
          plagiarism: `${plagiarismPercent}% detected`,
        },
      },
    }),
    ...(passed
      ? []
      : [
          prisma.revision.create({
            data: {
              articleId: review.articleId,
              note: `[Automated review] Not approved. ${summary} Revise the flagged content, then resubmit.`,
            },
          }),
        ]),
    prisma.notification.create({
      data: {
        userId: article.authorId,
        type: passed ? "system" : "revision",
        text: passed
          ? `“${article.title}” passed the originality review. You can publish it from Submit Article.`
          : `“${article.title}” didn't pass the originality review. ${summary}`,
      },
    }),
  ]);
  refreshViews();
}

/** Record a scan that Copyleaks could not complete. */
export async function failReview(reviewId: string, message: string): Promise<void> {
  await markError(reviewId, message);
}
