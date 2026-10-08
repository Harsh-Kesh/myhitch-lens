import Link from "next/link";

import { buttonClasses } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { hasActivePaidPlan } from "@/lib/billing";
import { getPlan, getSubmissionAllowance, ownedOrganizationId } from "@/lib/entitlements";
import type { PlanEntitlements } from "@/lib/plans";

import { PackagePicker } from "./PackagePicker";

/** The headline benefits shown on the plan card, in order, with how to test each against a plan. */
const BENEFITS: { label: string; has: (e: PlanEntitlements) => boolean }[] = [
  { label: "Verified Author badge", has: (e) => e.verifiedBadge },
  { label: "Standard analytics", has: (e) => e.analytics !== "basic" },
  { label: "Advanced analytics and audience insights", has: (e) => e.analytics === "advanced" && e.audienceInsights },
  { label: "Video / media embedding", has: (e) => e.videoEmbeds },
  { label: "SEO tools", has: (e) => e.seoTools !== "none" },
  { label: "Schedule publishing", has: (e) => e.schedulePublishing },
  { label: "Sponsored articles (Exchange Hub)", has: (e) => e.sponsoredArticles },
  { label: "Monetisation (sell your articles)", has: (e) => e.monetisation },
  { label: "Priority editorial review", has: (e) => e.priorityReview },
  { label: "Business profile and team accounts", has: (e) => e.businessProfile },
];

/** The author's current plan, this month's submission usage, and what the plan does and doesn't include. */
export async function PlanCard({ userId }: { userId: string }) {
  const [plan, allowance, ownsPaid, companyId] = await Promise.all([
    getPlan(userId),
    getSubmissionAllowance(userId),
    hasActivePaidPlan(userId),
    ownedOrganizationId(userId),
  ]);
  const included = BENEFITS.filter((b) => b.has(plan.entitlements));
  const missing = BENEFITS.filter((b) => !b.has(plan.entitlements));
  const pct = allowance.limit === null ? 0 : Math.min(100, Math.round((allowance.used / allowance.limit) * 100));

  return (
    <div className={dashCard + " mb-6"}>
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
                <li key={b.label}>✓ {b.label}</li>
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

      <PackagePicker current={plan.code} hasOwnPaidPlan={ownsPaid} canBuyBusiness={!!companyId} />
    </div>
  );
}
