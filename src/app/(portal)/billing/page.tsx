import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { buttonClasses } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { getPlan } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatAud } from "@/lib/plans";

import { openBillingPortal } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  past_due: "Payment past due",
  canceled: "Canceled",
  incomplete: "Not started",
};

/** The signed-in user's plan and billing: what they have, when it renews, and how to manage it. */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ upgraded?: string; error?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const { upgraded, error } = await searchParams;

  const [plan, sub] = await Promise.all([
    getPlan(session.user.id),
    prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { plan: true, status: true, interval: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, stripeCustomerId: true, extraSeats: true },
    }),
  ]);

  const paid = plan.code !== "free";
  const price = paid ? (sub?.interval === "year" ? plan.yearlyCents : plan.monthlyCents) : null;

  return (
    <>
      <ViewHeader title="Plan & billing" subtitle="Your MYHitch Lens plan, renewal and invoices." />

      {upgraded && (
        <p className="mb-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-[13px] font-medium text-success">
          You&apos;re now on {plan.name}. Your new benefits are active.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg border border-danger/40 bg-danger/8 px-4 py-3 text-[13px] font-medium text-danger">
          We couldn&apos;t open billing right now. Please try again shortly.
        </p>
      )}

      <div className={dashCard}>
        <h3 className={dashHeading}>{plan.name}</h3>
        <dl className="mb-5 grid grid-cols-2 gap-4 text-[13px] max-[560px]:grid-cols-1">
          <div>
            <dt className="text-[11px] font-medium text-text-muted uppercase">Price</dt>
            <dd className="mt-0.5 font-semibold text-text-main">
              {price ? `${formatAud(price)} / ${sub?.interval === "year" ? "year" : "month"}` : "Free"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-text-muted uppercase">Status</dt>
            <dd className="mt-0.5 font-semibold text-text-main">
              {paid && sub ? STATUS_LABEL[sub.status] ?? sub.status : "Active"}
            </dd>
          </div>
          {paid && plan.code === "business" && sub && (
            <div>
              <dt className="text-[11px] font-medium text-text-muted uppercase">Team seats</dt>
              <dd className="mt-0.5 font-semibold text-text-main">
                {plan.entitlements.includedSeats + sub.extraSeats} ({plan.entitlements.includedSeats} included
                {sub.extraSeats > 0 ? ` + ${sub.extraSeats} extra` : ""})
              </dd>
            </div>
          )}
          {paid && sub?.currentPeriodEnd && (
            <div>
              <dt className="text-[11px] font-medium text-text-muted uppercase">
                {sub.cancelAtPeriodEnd ? "Ends on" : "Renews on"}
              </dt>
              <dd className="mt-0.5 font-semibold text-text-main">
                {sub.currentPeriodEnd.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
              </dd>
            </div>
          )}
        </dl>

        {paid && sub?.cancelAtPeriodEnd && (
          <p className="mb-4 text-[12.5px] text-text-muted">
            Your plan is set to end at the close of this billing period. You keep your benefits until then, and you can
            resume it any time in Manage billing.
          </p>
        )}
        {paid && sub?.status === "past_due" && (
          <p className="mb-4 text-[12.5px] text-danger">
            Your last payment didn&apos;t go through. Update your payment method in Manage billing to keep your benefits.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {sub?.stripeCustomerId && (
            <form action={openBillingPortal}>
              <button type="submit" className={buttonClasses("primary", "md")}>
                Manage billing
              </button>
            </form>
          )}
          <Link href="/pricing" className={buttonClasses(paid ? "secondary" : "primary", "md")}>
            {paid ? "Compare plans" : "Upgrade your plan"}
          </Link>
        </div>
      </div>
    </>
  );
}
