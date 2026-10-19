import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared setup for the author-facing AI helpers (writing check, title/excerpt…).
 * Everything runs on the cheapest model (Haiku 5.5); move a single feature to a
 * bigger model only if its output proves too weak.
 */
export const AI_MODEL = "claude-haiku-5-5";

let client: Anthropic | null = null;

export function getAiClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI writing tools are not configured.");
  }
  client ??= new Anthropic();
  return client;
}

/** Per-author, per-feature cap so a runaway client can't burn the API budget. */
const DAILY_LIMIT = 30;
const COOLDOWN_MS = 5_000;

const usage = new Map<string, { day: string; count: number; last: number }>();

/**
 * Light in-memory throttle (resets on restart and isn't shared across server
 * instances) — enough to stop accidental hammering until real plan-based AI
 * limits are added.
 */
export function takeAiSlot(
  userId: string,
  feature: string,
  opts: { dailyLimit?: number; cooldownMs?: number } = {},
): { ok: true } | { ok: false; error: string } {
  const dailyLimit = opts.dailyLimit ?? DAILY_LIMIT;
  const cooldownMs = opts.cooldownMs ?? COOLDOWN_MS;
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const key = `${feature}:${userId}`;
  const entry = usage.get(key);
  if (entry && entry.day === day) {
    if (now - entry.last < cooldownMs) {
      return { ok: false, error: "Please wait a few seconds before trying again." };
    }
    if (entry.count >= dailyLimit) {
      return { ok: false, error: `You've used all ${dailyLimit} AI suggestions for this feature today. Try again tomorrow.` };
    }
    entry.count += 1;
    entry.last = now;
  } else {
    usage.set(key, { day, count: 1, last: now });
  }
  return { ok: true };
}
