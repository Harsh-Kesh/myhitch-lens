"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { startCheckout } from "@/app/(portal)/billing/actions";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { PLANS, PLAN_CODES, formatAud, type BillingInterval, type PlanCode } from "@/lib/plans";

/** What each package gives, in plain words (only things Lens actually delivers today). */
const HIGHLIGHTS: Record<PlanCode, string[]> = {
  free: ["2 article submissions a month", "Basic analytics", "Editorial review"],
  creator: ["10 article submissions a month", "Verified Author badge", "Standard analytics"],
  professional: [
    "Unlimited submissions",
    "Monetisation and sponsored articles",
    "Priority editorial review",
    "Advanced analytics and audience insights",
  ],
  business: ["Everything in Professional", "5 team seats, extra users AU$5/month", "Team management for your company"],
};

/**
 * The four packages on the author's own dashboard, with the current one marked
 * and a button to start checkout for any higher one. People who already pay
 * change plan in the billing portal, so the buttons point there instead.
 */
export function PackagePicker({
  current,
  hasOwnPaidPlan,
  canBuyBusiness,
}: {
  current: PlanCode;
  /** The user already has their own active paid subscription (change it in billing, don't buy a second). */
  hasOwnPaidPlan: boolean;
  /** The user owns a company, so Lens Business can be bought. */
  canBuyBusiness: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<PlanCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  function choose(code: PlanCode) {
    setError(null);
    setBusy(code);
    startTransition(async () => {
      const result = await startCheckout(code, interval);
      if ("url" in result) window.location.assign(result.url);
      else if ("login" in result) window.location.assign("/auth/login");
      else {
        setError(result.error);
        setBusy(null);
      }
    });
  }

  const currentIndex = PLAN_CODES.indexOf(current);

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-heading text-[14px] font-bold text-text-main">Choose your package</h4>
        <div className="flex items-center gap-1 rounded-full border border-line bg-bg-primary p-1 text-[12px] font-semibold">
          {(["month", "year"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setInterval(value)}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 transition-colors",
                interval === value ? "bg-primary text-text-inverse" : "text-text-muted hover:text-text-main",
              )}
            >
              {value === "month" ? "Monthly" : "Yearly (save 17%)"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
        {PLAN_CODES.map((code, index) => {
          const plan = PLANS[code];
          const isCurrent = code === current;
          const cents = interval === "year" ? plan.yearlyCents : plan.monthlyCents;
          const lower = index < currentIndex;

          let action: React.ReactNode = null;
          if (isCurrent) {
            action = <span className="block rounded-lg bg-primary-glow py-2 text-center text-[12.5px] font-bold text-primary">Current plan</span>;
          } else if (code === "free" || lower) {
            action = <span className="block py-2 text-center text-[12px] text-text-muted">Included in your plan</span>;
          } else if (hasOwnPaidPlan) {
            action = (
              <Link href="/billing" className={buttonClasses("secondary", "sm", "w-full")}>
                Change in Manage billing
              </Link>
            );
          } else if (code === "business" && !canBuyBusiness) {
            action = <span className="block py-2 text-center text-[12px] text-text-muted">For company accounts</span>;
          } else {
            action = (
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(code)}
                className={buttonClasses(code === "professional" ? "primary" : "secondary", "sm", "w-full")}
              >
                {busy === code ? "Please wait…" : `Choose ${plan.name.replace("Lens ", "")}`}
              </button>
            );
          }

          return (
            <div
              key={code}
              className={cn(
                "flex flex-col rounded-xl border p-4",
                isCurrent ? "border-primary bg-primary-glow/40" : "border-line bg-bg-primary",
              )}
            >
              <p className="font-heading text-[14px] font-bold text-text-main">{plan.name}</p>
              <p className="mt-1 font-heading text-[20px] font-extrabold text-text-main">
                {cents ? formatAud(cents) : "AU$0"}
                <span className="ml-1 text-[11.5px] font-medium text-text-muted">
                  {cents ? (interval === "year" ? "/ year" : "/ month") : "forever"}
                </span>
              </p>
              <ul className="my-3 flex flex-1 flex-col gap-1.5 text-[12px] text-text-muted">
                {HIGHLIGHTS[code].map((line) => (
                  <li key={line}>✓ {line}</li>
                ))}
              </ul>
              {action}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}
      <p className="mt-3 text-[11.5px] text-text-muted">
        Paid plans renew automatically and you can cancel any time in Manage billing.{" "}
        <Link href="/pricing" className="font-semibold text-primary hover:underline">
          Full comparison
        </Link>
      </p>
    </div>
  );
}
