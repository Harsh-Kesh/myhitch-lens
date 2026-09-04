import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { dashCard, dashHeading, StatChip } from "@/components/ui/DashboardKit";
import { DollarSignIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { getPayoutHistory } from "../payoutActions";

function formatAUD(n: number): string {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  pending: "Pending",
  failed: "Failed",
};

/** Full withdrawal history for the signed-in author. */
export default async function PayoutHistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.role !== "author") redirect("/author-dashboard");

  const { payouts, totalWithdrawn } = await getPayoutHistory(session.user.id);

  return (
    <>
      <ViewHeader title="Payout History" subtitle="Every withdrawal sent to your connected Stripe account." />

      <div className="mb-6 grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
        <StatChip icon={<DollarSignIcon className="size-4" />} value={formatAUD(totalWithdrawn)} label="Total withdrawn" accent />
        <StatChip icon={<DollarSignIcon className="size-4" />} value={payouts.length} label="Payouts made" />
      </div>

      <div className={dashCard}>
        <h3 className={dashHeading}>Withdrawals</h3>
        {payouts.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-text-muted">
            No withdrawals yet — they&apos;ll show up here once you send funds from the Author Dashboard.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {payouts.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg-primary px-4 py-3"
              >
                <div>
                  <div className="font-heading text-[15px] font-bold text-text-main">
                    {formatAUD(p.amount)} {p.currency}
                  </div>
                  <div className="text-[11.5px] text-text-muted">
                    {new Date(p.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    {p.stripeTransferId && <span className="ml-2 font-mono text-[10.5px]">{p.stripeTransferId}</span>}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold",
                    p.status === "paid" && "bg-success/10 text-success",
                    p.status === "pending" && "bg-warning/10 text-warning",
                    p.status === "failed" && "bg-danger/10 text-danger",
                  )}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
