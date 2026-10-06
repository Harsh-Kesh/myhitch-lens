"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Keys shared with /auth/callback. sessionStorage is per-tab, so a login started elsewhere is rejected. */
const STATE_KEY = "portal_sso_state";
const INTENT_KEY = "lens_sso_intent";

/** Roles the browser may hint at. A UI convenience only; the server re-validates on first sign-in. */
const HINTABLE_ROLES = new Set(["author", "corporate"]);

function newState(): string {
  const bytes = new Uint8Array(32); // 256-bit CSPRNG; base64url matches the portal's ^[A-Za-z0-9_-]{16,128}$
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * SSO launcher. Replaces the old username/password form: generates a CSRF
 * `state`, remembers it for this tab, and sends the browser to the MYHitch
 * Business portal. Forwards NO other query parameter to the portal.
 */
export default function AuthLoginPage() {
  const started = useRef(false); // React Strict Mode runs effects twice in dev
  const [storageError, setStorageError] = useState<string | null>(null);
  const portal = process.env.NEXT_PUBLIC_PORTAL_URL; // inlined at build time
  const error = !portal ? "Sign-in isn't configured yet. Please try again later." : storageError;

  useEffect(() => {
    if (started.current || !portal) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    try {
      const state = newState();
      sessionStorage.setItem(STATE_KEY, state);
      const role = params.get("role") ?? "";
      if (HINTABLE_ROLES.has(role)) sessionStorage.setItem(INTENT_KEY, role);
      else sessionStorage.removeItem(INTENT_KEY);

      const target = new URL("/api/sso/lens", portal);
      target.searchParams.set("state", state);
      if (params.get("mode") === "signup") target.searchParams.set("mode", "signup");
      window.location.replace(target.toString());
    } catch {
      // One-shot, only when sessionStorage is blocked: nothing else can surface this.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageError("Your browser blocked secure sign-in storage. Enable site data and try again.");
    }
  }, [portal]);

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-bg-secondary p-6 max-[480px]:p-4">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-4 rounded-2xl border border-line bg-bg-primary p-8 text-center shadow-card">
        <Link href="/">
          <Image src="/images/logo.png" alt="MYHitch Lens" width={260} height={147} priority className="h-14 w-auto object-contain" />
        </Link>
        {error ? (
          <>
            <p className="rounded-md border border-danger/40 bg-danger/8 px-3 py-2 text-xs font-medium text-danger">{error}</p>
            <Link href="/" className="text-[13px] text-primary hover:underline">Back to home</Link>
          </>
        ) : (
          <p className="text-[13px] text-text-muted">Taking you to MYHitch sign-in…</p>
        )}
      </div>
    </div>
  );
}
