/**
 * How an article's automated review turns into a pass or a fail. Plain functions, no server imports.
 *
 * Both inputs are "how bad" percentages from Copyleaks, so each is flipped into a "how good" score first
 * and the combined score is a weighted average of the two: higher is better, 0-100. An article passes when
 * the combined score reaches the pass mark.
 *
 * Copyleaks has no separate copyright score; the plagiarism scan is what flags copied text. To add another
 * signal, give it a weight in `ReviewConfig` and a term in `scoreReview`.
 */

export interface ReviewConfig {
  /** Combined score an article needs to pass, 0-100. */
  passMark: number;
  /** Weight of the plagiarism (originality) score. */
  plagiarismWeight: number;
  /** Weight of the human-written score (the inverse of the AI-generated share). */
  aiWeight: number;
}

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = { passMark: 70, plagiarismWeight: 0.7, aiWeight: 0.3 };

function envNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

/** The pass mark and weights, from REVIEW_PASS_SCORE / REVIEW_WEIGHT_PLAGIARISM / REVIEW_WEIGHT_AI. */
export function getReviewConfig(): ReviewConfig {
  return {
    passMark: envNumber("REVIEW_PASS_SCORE", DEFAULT_REVIEW_CONFIG.passMark, 0, 100),
    plagiarismWeight: envNumber("REVIEW_WEIGHT_PLAGIARISM", DEFAULT_REVIEW_CONFIG.plagiarismWeight, 0, 1),
    aiWeight: envNumber("REVIEW_WEIGHT_AI", DEFAULT_REVIEW_CONFIG.aiWeight, 0, 1),
  };
}

const clampPercent = (n: number) => Math.min(100, Math.max(0, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface ReviewScore {
  /** 0-100, higher is better. */
  combinedScore: number;
  passed: boolean;
}

/**
 * `aiPercent` is null when the AI-content check could not run; the plagiarism score then carries the whole
 * decision rather than the article being marked down for something we could not measure.
 */
export function scoreReview(
  input: { plagiarismPercent: number; aiPercent: number | null },
  config: ReviewConfig = getReviewConfig(),
): ReviewScore {
  const originality = 100 - clampPercent(input.plagiarismPercent);
  const humanWritten = input.aiPercent === null ? null : 100 - clampPercent(input.aiPercent);

  const useAi = humanWritten !== null && config.aiWeight > 0;
  const totalWeight = config.plagiarismWeight + (useAi ? config.aiWeight : 0);
  const combined =
    totalWeight === 0
      ? originality
      : (originality * config.plagiarismWeight + (useAi ? humanWritten * config.aiWeight : 0)) / totalWeight;

  const combinedScore = round1(combined);
  return { combinedScore, passed: combinedScore >= config.passMark };
}
