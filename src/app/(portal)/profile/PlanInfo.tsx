import Link from "next/link";

import { PackagePicker } from "@/app/(portal)/author-dashboard/PackagePicker";
import { buttonClasses } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { freePlanSwitchEnabled, hasActivePaidPlan } from "@/lib/billing";
import { getPlan, getSubmissionAllowance } from "@/lib/entitlements";
import { PLAN_BENEFITS } from "@/lib/planBenefits";
import { prisma } from "@/lib/prisma";

/**
 * My Profile: the user's current plan, this month's submission usage, what the plan
 * does and doesn't include, and the package picker. This is the same card that used
 * to sit on the Author dashboard, unchanged in design.
 */
export async function PlanInfo({ userId }: { userId: string }) {
  const [plan, allowance, ownsPaid, own] = await Promise.all([
    getPlan(userId),
    getSubmissionAllowance(userId),
    hasActivePaidPlan(userId),
    prisma.subscription.findUnique({ where: { userId }, select: { plan: true, status: true } }),
  ]);
  const included = PLAN_BENEFITS.filter((b) => b.has(plan.entitlements));
  const missing = PLAN_BENEFITS.filter((b) => !b.has(plan.entitlements));
  const pct = allowance.limit === null ? 0 : Math.min(100, Math.round((allowance.used / allowance.limit) * 100));
  // A company member shares the owner's Business plan, so there is nothing for them to switch.
  const throughCompany = plan.code === "business" && !(own?.plan === "business" && own.status !== "canceled");

  return (
    <div className={dashCard + " mt-6"}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className={dashHeading + " mb-0"}>Your plan: {plan.name}</h3>
        {ownsPaid && (
          <Link href="/billing" className={buttonClasses("secondary", "sm")}>
            Manage billing
          </Link>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-[12.5px] text-text-muted">
          <span>Article submissions this month</span>
          <span className="font-semibold text-text-main">
            {allowance.limit === null ? `${allowance.used} (unlimited)` : `${allowance.used} of ${allowance.limit}`}
          </span>
        </div>
        {allowance.limit !== null && (
          <div className="h-2 overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className={pct >= 100 ? "h-full bg-danger" : "h-full bg-primary"}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {!allowance.allowed && (
          <p className="mt-2 text-[12px] text-danger">
            You&apos;ve used all your submissions for this month. They reset on the 1st; upgrade to submit more now.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-[12.5px] max-[560px]:grid-cols-1">
        <div>
          <p className="mb-1 text-[11px] font-bold tracking-wide text-text-muted uppercase">Included</p>
          {included.length === 0 ? (
            <p className="text-text-muted">The essentials: write, submit and get reviewed.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-text-main">
              {included.map((b) => (
                <li key={b.label}>✓ {b.label}{b.comingSoon && <span className="text-text-muted"> (coming soon)</span>}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold tracking-wide text-text-muted uppercase">Not on your plan</p>
          {missing.length === 0 ? (
            <p className="text-text-muted">Everything is unlocked.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-text-muted">
              {missing.map((b) => (
                <li key={b.label}>– {b.label}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!throughCompany && (
        <div id="packages">
          <PackagePicker
            current={plan.code}
            hasOwnPaidPlan={ownsPaid}
            freeSwitch={freePlanSwitchEnabled()}
          />
        </div>
      )}
    </div>
  );
}
