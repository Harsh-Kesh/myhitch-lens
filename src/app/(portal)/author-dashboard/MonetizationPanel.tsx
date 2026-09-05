"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { Modal } from "@/components/ui/Modal";
import { formControl, formLabel } from "@/components/ui/Form";
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
  const [showWithdraw, setShowWithdraw] = useState(false);

  function doConnect() {
    startTransition(async () => {
      const res = await startStripeConnectOnboarding();
      if ("error" in res) alert(res.error);
      else window.location.href = res.url;
    });
  }

  function openWithdraw() {
    if (walletBalance <= 0) {
      alert("You have no funds available to withdraw yet — it appears here once a sale or sponsorship deal settles.");
      return;
    }
    setShowWithdraw(true);
  }

  function submitWithdraw(amount: number) {
    startTransition(async () => {
      const res = await requestPayout(amount);
      if ("error" in res) alert(res.error);
      else {
        setShowWithdraw(false);
        router.refresh();
      }
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
          <Button size="sm" className="mt-5 w-full" disabled={isPending} onClick={openWithdraw}>
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

      {showWithdraw && (
        <WithdrawModal
          walletBalance={walletBalance}
          pending={isPending}
          onClose={() => setShowWithdraw(false)}
          onSubmit={submitWithdraw}
        />
      )}
    </div>
  );
}

function WithdrawModal({
  walletBalance,
  pending,
  onClose,
  onSubmit,
}: {
  walletBalance: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(walletBalance.toFixed(2));
  const parsed = Number(amount);
  const valid =
    Number.isFinite(parsed) &&
    parsed >= MARKETPLACE_DEFAULTS.payoutMinimum &&
    parsed <= walletBalance;

  return (
    <Modal onClose={onClose} className="w-[min(400px,92vw)]">
      <h3 className="mb-1 font-heading text-lg font-bold text-text-main">Withdraw Funds</h3>
      <p className="mb-4 text-[12.5px] text-text-muted">
        Choose how much to send to your connected Stripe account. Available: {formatAUD(walletBalance)}.
      </p>

      <div className="mb-2">
        <label className={formLabel}>Amount (AUD)</label>
        <input
          type="number"
          min={MARKETPLACE_DEFAULTS.payoutMinimum}
          max={walletBalance}
          step="0.01"
          className={formControl}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="mb-5 flex justify-between text-[11px] text-text-muted">
        <button type="button" className="cursor-pointer text-primary hover:underline" onClick={() => setAmount(walletBalance.toFixed(2))}>
          Withdraw full balance
        </button>
        <span>Minimum A${MARKETPLACE_DEFAULTS.payoutMinimum}</span>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" disabled={pending || !valid} onClick={() => onSubmit(parsed)}>
          {pending ? "Processing..." : `Withdraw ${valid ? formatAUD(parsed) : ""}`}
        </Button>
      </div>
    </Modal>
  );
}
