"use client";

import Link from "next/link";

import { buttonClasses } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { DollarSignIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

import type { ConnectStatus } from "./payoutActions";

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
  // Payout accounts live in MYHitch Business; Lens only links there. Inlined at build time.
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL;
  const setupHref = portalUrl ? `${portalUrl}/onboarding/business` : null;

  return (
    <div className={cn(dashCard, "self-start")}>
      <h3 className={dashHeading}>
        <DollarSignIcon className="size-[18px] text-primary" /> Monetization
      </h3>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-lg border border-line bg-bg-primary p-4">
          <span className="text-[11px] font-medium text-text-muted uppercase">Wallet balance</span>
          <span className="font-heading text-xl font-extrabold text-success">{formatAUD(walletBalance)}</span>
        </div>
        <p className="-mt-1 px-1 text-[10.5px] text-text-muted">
          Held as platform credit. Withdrawals from this balance aren&apos;t available in Lens right now; your balance is
          kept safe and stays yours.
        </p>
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
          Payout status is temporarily unavailable — please try again shortly.
        </p>
      ) : !connectStatus.connected || !connectStatus.payoutsEnabled ? (
        <>
          {setupHref && (
            <a
              href={setupHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("primary", "sm", "mt-5 w-full")}
            >
              {connectStatus.connected ? "Finish payout setup" : "Set up payouts in MYHitch Business"}
            </a>
          )}
          <p className="mt-2 text-center text-[10.5px] text-text-muted">
            {connectStatus.connected
              ? "Your payout account needs a few more details before it can receive funds."
              : "Payouts are set up once in MYHitch Business — it takes a couple of minutes."}
          </p>
        </>
      ) : (
        <p className="mt-5 rounded-lg bg-bg-tertiary p-3 text-center text-[11.5px] text-text-muted">
          Your payout account is active in MYHitch Business. Payouts and bank details are managed there.
        </p>
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
