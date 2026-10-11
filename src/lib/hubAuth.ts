import "server-only";

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * The MYHitch hub (backend of the MYHitch mobile app) calls Lens with its own
 * X-Api-Key (HUB_API_KEY). Businesses it signs in get a Lens hub session
 * token, sent back as a Bearer token on the company routes.
 */

function sameSecret(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

/** A response refusing the call, or null when the hub's key is right. */
export function hubDenied(request: Request): NextResponse | null {
  const expected = process.env.HUB_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: "MYHitch hub integration is not configured yet." }, { status: 501 });
  }
  const given = request.headers.get("x-api-key") ?? "";
  if (!given || !sameSecret(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

const SESSION_DAYS = 30;

function signingKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`lens-hub-session:${secret}`).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/** A 30-day session for [userId], opened through the hub. */
export function issueHubToken(userId: string): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 3600;
  const payload = `${Buffer.from(userId).toString("base64url")}.${exp}`;
  return {
    token: `${payload}.${sign(payload)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/** The user a hub session token belongs to, or null if it isn't valid. */
export function verifyHubToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return null;
  if (!sameSecret(sig, sign(`${id}.${exp}`))) return null;
  try {
    return Buffer.from(id, "base64url").toString("utf8") || null;
  } catch {
    return null;
  }
}

export function bearer(request: Request): string {
  const auth = request.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}
