"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { completePortalSignIn } from "@/app/auth/actions";

const STATE_KEY = "portal_sso_state";
const INTENT_KEY = "lens_sso_intent";
const NEXT_KEY = "lens_sso_next";

/**
 * SSO return leg. Order matters:
 *  1. run once;
 *  2. read ticket/state, and single-read (remove) the stored state + intent;
 *  3. strip the ticket from the address bar and history immediately;
 *  4. refuse unless the returned state equals the one THIS tab stored (blocks
 *     login CSRF), and in that case never call the server;
 *  5. only then redeem the ticket.
 */
export default function AuthCallbackPage() {
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("ticket");
    const state = params.get("state");

    let expected: string | null = null;
    let intent = "";
    let next = "";
    try {
      expected = sessionStorage.getItem(STATE_KEY);
      intent = sessionStorage.getItem(INTENT_KEY) ?? "";
      next = sessionStorage.getItem(NEXT_KEY) ?? "";
      sessionStorage.removeItem(STATE_KEY);
      sessionStorage.removeItem(INTENT_KEY);
      sessionStorage.removeItem(NEXT_KEY);
    } catch {
      /* storage blocked: expected stays null and the attempt is refused below */
    }

    window.history.replaceState(null, "", "/auth/callback");

    if (!ticket || !state || !expected || expected !== state) {
      setError("This sign-in didn't start here. Please start again from the sign-in button.");
      return;
    }

    completePortalSignIn(ticket, intent, next).then((result) => {
      // Success redirects server-side; only failures come back.
      if (result?.error) setError(result.error);
    });
  }, []);

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-bg-secondary p-6 max-[480px]:p-4">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-4 rounded-2xl border border-line bg-bg-primary p-8 text-center shadow-card">
        <Link href="/">
          <Image src="/images/logo.png" alt="MYHitch Lens" width={260} height={147} priority className="h-14 w-auto object-contain" />
        </Link>
        {error ? (
          <>
            <p className="rounded-md border border-danger/40 bg-danger/8 px-3 py-2 text-xs font-medium text-danger">{error}</p>
            <Link href="/auth/login" className="text-[13px] font-semibold text-primary hover:underline">Try signing in again</Link>
          </>
        ) : (
          <p className="text-[13px] text-text-muted">Signing you in…</p>
        )}
      </div>
    </div>
  );
}
