import Link from "next/link";

import { buttonClasses } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { freePlanSwitchEnabled } from "@/lib/billing";
import { getPlan, getSubmissionAllowance } from "@/lib/entitlements";
import { PLAN_BENEFITS } from "@/lib/planBenefits";
import { formatAud } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  past_due: "Payment past due",
  canceled: "Canceled",
  incomplete: "Not started",
};

/** My Profile: the user's current plan, what it costs, when it renews, what it includes, and where to change it. */
export async function PlanInfo({ userId, role }: { userId: string; role: string }) {
  const [plan, allowance, sub] = await Promise.all([
    getPlan(userId),
    getSubmissionAllowance(userId),
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true, interval: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, stripeSubscriptionId: true, extraSeats: true },
    }),
  ]);

  const paysViaStripe = !!sub?.stripeSubscriptionId && sub.plan !== "free";
  const ownPlan = !!sub && sub.plan === plan.code && sub.status !== "canceled";
  const throughCompany = plan.code === "business" && !ownPlan; // a company member sharing the owner's Business plan
  const noPayment = ownPlan && sub?.plan !== "free" && !paysViaStripe; // switched on in test mode
  const cents = ownPlan && sub?.interval === "year" ? plan.yearlyCents : plan.monthlyCents;
  const included = PLAN_BENEFITS.filter((b) => b.has(plan.entitlements));
  const missing = PLAN_BENEFITS.filter((b) => !b.has(plan.entitlements));
  const pct = allowance.limit === null ? 0 : Math.min(100, Math.round((allowance.used / allowance.limit) * 100));
  const changeHref = role === "author" ? "/author-dashboard#packages" : "/pricing";

  return (
    <div className={dashCard + " mt-6"}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className={dashHeading + " mb-0"}>Your plan</h3>
        <div className="flex flex-wrap gap-2">
          {paysViaStripe && (
            <Link href="/billing" className={buttonClasses("secondary", "sm")}>
              Manage billing
            </Link>
          )}
          {!throughCompany && (
            <Link href={changeHref} className={buttonClasses(plan.code === "free" ? "primary" : "secondary", "sm")}>
              {plan.code === "free" ? "Upgrade your plan" : "Change package"}
            </Link>
          )}
        </div>
      </div>

      <dl className="mb-4 grid grid-cols-3 gap-4 text-[13px] max-[640px]:grid-cols-1">
        <div>
          <dt className="text-[11px] font-medium text-text-muted uppercase">Package</dt>
          <dd className="mt-0.5 font-semibold text-text-main">
            {plan.name}
            {throughCompany && <span className="font-normal text-text-muted"> (through your company)</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-text-muted uppercase">Price</dt>
          <dd className="mt-0.5 font-semibold text-text-main">
            {throughCompany
              ? "Paid by your company"
              : noPayment
                ? "No payment (test mode)"
                : cents
                  ? `${formatAud(cents)} / ${sub?.interval === "year" ? "year" : "month"}`
                  : "Free"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-text-muted uppercase">
            {paysViaStripe && sub?.cancelAtPeriodEnd ? "Ends on" : "Status"}
          </dt>
          <dd className="mt-0.5 font-semibold text-text-main">
            {paysViaStripe && sub?.currentPeriodEnd
              ? `${sub.cancelAtPeriodEnd ? "" : "Renews "}${sub.currentPeriodEnd.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`
              : paysViaStripe && sub
                ? (STATUS_LABEL[sub.status] ?? sub.status)
                : "Active"}
          </dd>
        </div>
      </dl>

      {paysViaStripe && sub?.status === "past_due" && (
        <p className="mb-3 text-[12.5px] text-danger">
          Your last payment didn&apos;t go through. Update your payment method in Manage billing to keep your benefits.
        </p>
      )}
      {freePlanSwitchEnabled() && (
        <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          Test mode: you can switch packages on your Author dashboard without paying.
        </p>
      )}

      {role === "author" && (
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-[12.5px] text-text-muted">
            <span>Article submissions this month</span>
            <span className="font-semibold text-text-main">
              {allowance.limit === null ? `${allowance.used} (unlimited)` : `${allowance.used} of ${allowance.limit}`}
            </span>
          </div>
          {allowance.limit !== null && (
            <div className="h-2 overflow-hidden rounded-full bg-bg-tertiary">
              <div className={pct >= 100 ? "h-full bg-danger" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-[12.5px] max-[560px]:grid-cols-1">
        <div>
          <p className="mb-1 text-[11px] font-bold tracking-wide text-text-muted uppercase">Included</p>
          {included.length === 0 ? (
            <p className="text-text-muted">The essentials: write, submit and get reviewed.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-text-main">
              {included.map((b) => (
                <li key={b.label}>
                  ✓ {b.label}
                  {b.comingSoon && <span className="text-text-muted"> (coming soon)</span>}
                </li>
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
    </div>
  );
}
