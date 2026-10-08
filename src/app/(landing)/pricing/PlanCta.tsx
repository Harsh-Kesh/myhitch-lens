"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { startCheckout } from "@/app/(portal)/billing/actions";
import { buttonClasses, type ButtonVariant } from "@/components/ui/Button";
import type { BillingInterval, PlanCode } from "@/lib/plans";

/**
 * The call-to-action on a plan card.
 *  - Free: the normal sign-up link.
 *  - Paid: starts Stripe Checkout. If the visitor isn't signed in, they sign in
 *    first and come straight back to this plan's checkout (`?plan=…&interval=…`).
 */
export function PlanCta({
  code,
  interval,
  label,
  variant,
  freeHref,
}: {
  code: PlanCode;
  interval: BillingInterval;
  label: string;
  variant: ButtonVariant;
  freeHref: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const resumed = useRef(false);

  function begin(chosen: BillingInterval) {
    setError(null);
    startTransition(async () => {
      const result = await startCheckout(code, chosen);
      if ("url" in result) {
        window.location.assign(result.url);
      } else if ("login" in result) {
        const back = `/pricing?plan=${code}&interval=${chosen}`;
        window.location.assign(`/auth/login?mode=signup&role=${code === "business" ? "corporate" : "author"}&next=${encodeURIComponent(back)}`);
      } else {
        setError(result.error);
      }
    });
  }

  // Back from sign-in with this plan chosen: continue to checkout automatically.
  useEffect(() => {
    if (code === "free" || resumed.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("plan") !== code) return;
    resumed.current = true;
    const chosen: BillingInterval = params.get("interval") === "year" ? "year" : "month";
    window.history.replaceState(null, "", "/pricing");
    // Starting the redirect to checkout is the one-off side effect of arriving here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    begin(chosen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (code === "free") {
    return (
      <Link href={freeHref} className={buttonClasses(variant, "md", "w-full")}>
        {label}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => begin(interval)}
        className={buttonClasses(variant, "md", "w-full")}
      >
        {isPending ? "Please wait…" : label}
      </button>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </>
  );
}
