"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { formControl } from "@/components/ui/Form";
import { cn } from "@/lib/cn";
import { DONATION_DEFAULTS, PLATFORM_FEES } from "@/lib/platformConfig";
import { createDonationCheckout } from "./actions";

export function SupportAuthorModal({
  articleId,
  authorName,
  onClose,
}: {
  articleId: string;
  authorName: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<number>(DONATION_DEFAULTS.presetAmounts[1]);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function pick(value: number) {
    setAmount(value);
    setCustom("");
  }

  function submit() {
    setError(null);
    const value = custom.trim() ? Number(custom) : amount;
    startTransition(async () => {
      const res = await createDonationCheckout(articleId, value);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      window.location.href = res.url;
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 z-50 w-[min(420px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-bg-secondary p-6 shadow-card">
        <h3 className="mb-1 font-heading text-base font-bold text-text-main">Support {authorName}</h3>
        <p className="mb-4 text-[12.5px] text-text-muted">
          Send a one-time contribution directly to this author. {Math.round((1 - PLATFORM_FEES.donation) * 100)}% goes to them.
        </p>

        <div className="mb-3 grid grid-cols-4 gap-2">
          {DONATION_DEFAULTS.presetAmounts.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => pick(preset)}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-2 text-sm font-semibold transition-colors",
                !custom && amount === preset
                  ? "border-primary bg-primary-glow text-primary"
                  : "border-line bg-bg-primary text-text-main hover:border-line-hover",
              )}
            >
              ${preset}
            </button>
          ))}
        </div>

        <input
          type="number"
          min={DONATION_DEFAULTS.minAmount}
          max={DONATION_DEFAULTS.maxAmount}
          placeholder={`Custom amount ($${DONATION_DEFAULTS.minAmount}–$${DONATION_DEFAULTS.maxAmount})`}
          className={cn(formControl, "mb-3")}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
        />

        {error && <p className="mb-3 text-[12px] font-medium text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={isPending}>
            {isPending ? "Redirecting..." : "Continue to Payment"}
          </Button>
        </div>
      </div>
    </>
  );
}
