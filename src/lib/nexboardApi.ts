import { NextResponse } from "next/server";
import { nexboardDenied } from "@/lib/nexboardReview";

/**
 * Shared parts of the read-only data API MYHitch NexBoard calls (standards/platform-data-api.md, NEXBOARD_DATA_CONTRACT.md):
 * parameter checks, the response envelope, and one log line per call. Routes under /api/nexboard/ping, dashboard and magazine use it.
 */

export const MAX_DAYS = 400;
export const MAX_IDS = 100;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Milliseconds of a real calendar day "YYYY-MM-DD" (UTC midnight), or null when it is not one (2026-02-30 is not). */
function dayMs(s: string | null): number | null {
  if (!s || !DAY.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s ? null : t;
}

/** Days from..to counting both ends, or an error sentence. */
function spanOf(label: string, from: string, to: string): string | null {
  const a = dayMs(from);
  const b = dayMs(to);
  if (a === null || b === null) return `${label} dates must be real days written YYYY-MM-DD.`;
  if (b < a) return `${label} end is before its start.`;
  if ((b - a) / 86_400_000 + 1 > MAX_DAYS) return `${label} range is longer than ${MAX_DAYS} days.`;
  return null;
}

export type DayRange = { from: string; to: string };
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** `from` and `to` (both required). */
export function parseRange(p: URLSearchParams): Parsed<DayRange> {
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  const error = spanOf("The", from, to);
  return error ? { ok: false, error } : { ok: true, value: { from, to } };
}

/** `from`, `to`, `prevFrom`, `prevTo` (all required): the period shown and the one before it. */
export function parsePeriod(p: URLSearchParams): Parsed<DayRange & { prevFrom: string; prevTo: string }> {
  const range = parseRange(p);
  if (!range.ok) return { ok: false, error: range.error.replace("The", "The period") };
  const prevFrom = p.get("prevFrom") ?? "";
  const prevTo = p.get("prevTo") ?? "";
  const error = spanOf("The previous period", prevFrom, prevTo);
  return error ? { ok: false, error } : { ok: true, value: { ...range.value, prevFrom, prevTo } };
}

/** A comma-separated id list: blanks dropped, repeats removed. `min` 0 allows an empty list. At most MAX_IDS ids, each up to 100 characters. */
export function parseIds(raw: string | null, name: string, min: 0 | 1): Parsed<string[]> {
  const ids = [...new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
  if (ids.length < min) return { ok: false, error: `${name} needs at least one id.` };
  if (ids.length > MAX_IDS) return { ok: false, error: `${name} takes at most ${MAX_IDS} ids.` };
  if (ids.some((i) => i.length > 100)) return { ok: false, error: `${name} has an id that is too long.` };
  return { ok: true, value: ids };
}

type Extra = { meta?: object; range?: object; platform?: string };

/** The success body every endpoint returns. */
export const envelope = (contract: string, data: unknown, extra: Extra = {}) => {
  const { platform, meta, range } = extra;
  return { contract, ...(platform ? { platform } : {}), asOf: new Date().toISOString(), data, ...(meta ? { meta } : {}), ...(range ? { range } : {}) };
};

const NO_STORE = { "cache-control": "no-store" };
export const okJson = (contract: string, data: unknown, extra?: Extra) => NextResponse.json(envelope(contract, data, extra), { headers: NO_STORE });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400, headers: NO_STORE });

/** One log line per call: endpoint, outcome, status, time taken, client address. Never bodies or keys. A failed log never fails the call. */
export function logCall(endpoint: string, status: number, startedAt: number, request: Request) {
  try {
    const outcome = status === 401 || status === 501 ? "refused" : status < 400 ? "ok" : "error";
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    console.info(JSON.stringify({ nexboard_call: "lens", at: new Date().toISOString(), endpoint, outcome, status, ms: Date.now() - startedAt, ip }));
  } catch {
    /* logging must never break the call */
  }
}

/** Runs one NexBoard GET: key check first (401 or 501), then the handler; a thrown error is logged here and answered with a generic 500. */
export async function nexboardGet(request: Request, endpoint: string, handler: (params: URLSearchParams) => Promise<NextResponse>, deny: (r: Request) => NextResponse | null = nexboardDenied): Promise<NextResponse> {
  const startedAt = Date.now();
  let res: NextResponse;
  try {
    res = deny(request) ?? (await handler(new URL(request.url).searchParams));
  } catch (e) {
    console.error(`NexBoard ${endpoint} failed`, e);
    res = NextResponse.json({ error: "Lens could not read its data just now." }, { status: 500, headers: NO_STORE });
  }
  res.headers.set("cache-control", "no-store");
  logCall(endpoint, res.status, startedAt, request);
  return res;
}
