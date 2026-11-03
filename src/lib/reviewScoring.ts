/**
 * How an article's automated review turns into a pass or a fail. Plain functions, no server imports.
 *
 * The two Copyleaks results are judged separately, each against its own limit, and the article passes only
 * when BOTH are within their limit. There is no combined score: a very low AI percentage can't make up for
 * heavy plagiarism, or the other way round.
 *
 * Copyleaks has no separate copyright score; the plagiarism scan is what flags copied text.
 */

export interface ReviewConfig {
  /** The most matched (plagiarised) text an article may have, as a percentage. Above this it fails. */
  maxPlagiarismPercent: number;
  /** The most AI-generated text an article may have, as a percentage. Above this it fails. */
  maxAiPercent: number;
}

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = { maxPlagiarismPercent: 20, maxAiPercent: 30 };

function envPercent(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : fallback;
}

/** The limits, from REVIEW_MAX_PLAGIARISM and REVIEW_MAX_AI (percentages, 0-100). */
export function getReviewConfig(): ReviewConfig {
  return {
    maxPlagiarismPercent: envPercent("REVIEW_MAX_PLAGIARISM", DEFAULT_REVIEW_CONFIG.maxPlagiarismPercent),
    maxAiPercent: envPercent("REVIEW_MAX_AI", DEFAULT_REVIEW_CONFIG.maxAiPercent),
  };
}

/** A check that has had no result after this long is treated as failed, so the author can run it again. */
export const REVIEW_STALE_MINUTES = 10;

export function isReviewStale(createdAt: Date, now: number = Date.now()): boolean {
  return now - createdAt.getTime() > REVIEW_STALE_MINUTES * 60_000;
}

export interface ReviewVerdict {
  plagiarismPassed: boolean;
  /** Null when the AI-content check couldn't run, so there was nothing to judge. */
  aiPassed: boolean | null;
  /** True only when plagiarism is within its limit and AI is not over its limit. */
  passed: boolean;
}

/**
 * Each percentage may equal its limit and still pass; only going above it fails.
 * `aiPercent` is null when the AI-content check could not run (for instance the text is too short for it).
 * That is not held against the article: plagiarism alone decides, rather than blocking it for something we
 * could not measure.
 */
export function judgeReview(
  input: { plagiarismPercent: number; aiPercent: number | null },
  config: ReviewConfig = getReviewConfig(),
): ReviewVerdict {
  const plagiarismPassed = input.plagiarismPercent <= config.maxPlagiarismPercent;
  const aiPassed = input.aiPercent === null ? null : input.aiPercent <= config.maxAiPercent;
  return { plagiarismPassed, aiPassed, passed: plagiarismPassed && aiPassed !== false };
}
