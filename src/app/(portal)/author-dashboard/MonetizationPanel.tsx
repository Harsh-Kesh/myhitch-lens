"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { DollarSignIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { MARKETPLACE_DEFAULTS } from "@/lib/platformConfig";

import { requestPayout, startStripeConnectOnboarding, type ConnectStatus } from "./payoutActions";

function formatAUD(n: number): string {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MonetizationPanel({
  walletBalance,
  totalEarnings,
  totalWithdrawn,
  earningsBreakdown,
  connectStatus,
}: {
  walletBalance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  earningsBreakdown: { label: string; value: number }[];
  connectStatus: ConnectStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function doConnect() {
    startTransition(async () => {
      const res = await startStripeConnectOnboarding();
      if ("error" in res) alert(res.error);
      else window.location.href = res.url;
    });
  }

  function doWithdraw() {
    if (!confirm(`Withdraw ${formatAUD(walletBalance)} to your connected Stripe account?`)) return;
    startTransition(async () => {
      const res = await requestPayout();
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className={cn(dashCard, "self-start")}>
      <h3 className={dashHeading}>
        <DollarSignIcon className="size-[18px] text-primary" /> Monetization
      </h3>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-lg border border-line bg-bg-primary p-4">
          <span className="text-[11px] font-medium text-text-muted uppercase">Available balance</span>
          <span className="font-heading text-xl font-extrabold text-success">{formatAUD(walletBalance)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-line bg-bg-primary p-4">
          <span className="text-[11px] font-medium text-text-muted uppercase">Withdrawn to date</span>
          <span className="font-heading text-xl font-extrabold text-text-main">{formatAUD(totalWithdrawn)}</span>
        </div>
      </div>
      {earningsBreakdown.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {earningsBreakdown.map((row) => (
            <div key={row.label} className="flex justify-between text-[13px]">
              <span className="text-text-muted">{row.label}</span>
              <span className="font-medium text-success">+{formatAUD(row.value)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-3 text-[13px] font-semibold">
            <span className="text-text-main">Total earned</span>
            <span className="text-success">{formatAUD(totalEarnings)}</span>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-center text-[12px] text-text-muted">No earnings yet — revenue appears as readers engage with your content.</p>
      )}

      {!connectStatus.configured ? (
        <p className="mt-5 rounded-lg bg-bg-tertiary p-3 text-center text-[11.5px] text-text-muted">
          Payouts aren&apos;t set up yet — check back soon.
        </p>
      ) : !connectStatus.connected ? (
        <>
          <Button size="sm" className="mt-5 w-full" disabled={isPending} onClick={doConnect}>
            {isPending ? "Redirecting..." : "Connect Stripe Account"}
          </Button>
          <p className="mt-2 text-center text-[10.5px] text-text-muted">
            Required once before you can withdraw — takes a couple of minutes.
          </p>
        </>
      ) : !connectStatus.payoutsEnabled ? (
        <>
          <Button size="sm" className="mt-5 w-full" disabled={isPending} onClick={doConnect}>
            {isPending ? "Redirecting..." : "Finish Connecting Stripe"}
          </Button>
          <p className="mt-2 text-center text-[10.5px] text-text-muted">
            Your Stripe account needs a few more details before payouts can go out.
          </p>
        </>
      ) : (
        <>
          <Button
            size="sm"
            className="mt-5 w-full"
            disabled={isPending || walletBalance < MARKETPLACE_DEFAULTS.payoutMinimum}
            onClick={doWithdraw}
          >
            {isPending ? "Processing..." : "Withdraw Funds"}
          </Button>
          <p className="mt-2 text-center text-[10.5px] text-text-muted">
            Minimum payout A${MARKETPLACE_DEFAULTS.payoutMinimum} · paid via Stripe · Stripe&apos;s fee is deducted from your payout
          </p>
        </>
      )}

      <Link
        href="/author-dashboard/payouts"
        className="mt-4 block text-center text-[11.5px] font-semibold text-primary hover:underline"
      >
        View payout history →
      </Link>
    </div>
  );
}
