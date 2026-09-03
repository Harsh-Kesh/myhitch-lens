"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { BriefcaseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { EditorOpportunity } from "@/lib/exchange";

import {
  approveExchangeOpportunity,
  recordExchangeAgreement,
  rejectExchangeOpportunity,
} from "../exchange/actions";

const TYPE_LABEL: Record<string, string> = {
  sponsorship: "Sponsorship",
  advertising: "Advertising",
  bidding: "Bidding",
  partnership: "Partnership",
  collaboration: "Commercial Collaboration",
  other: "Other",
};

function formatAUD(n: number): string {
  return `A$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Editor/admin-facing queue for opportunities routed through the Exchange
 * Hub. Stands in for MYHitch Connect's own negotiation + approval workflow
 * until that module exists — an editor records the deal a business struck
 * with the author, then approves it, which publishes the article for real.
 */
export function ExchangeOpportunityQueue({ opportunities }: { opportunities: EditorOpportunity[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [agreeingOn, setAgreeingOn] = useState<EditorOpportunity | null>(null);

  function refresh() {
    router.refresh();
  }

  function doApprove(id: string) {
    if (!confirm("Approve this agreement? The article publishes immediately with the agreed sponsor terms.")) return;
    startTransition(async () => {
      const res = await approveExchangeOpportunity(id);
      if ("error" in res) alert(res.error);
      else refresh();
    });
  }

  function doReject(id: string) {
    const note = prompt("Reason for rejecting this opportunity (the author will see it):");
    if (!note?.trim()) return;
    startTransition(async () => {
      const res = await rejectExchangeOpportunity(id, note.trim());
      if ("error" in res) alert(res.error);
      else refresh();
    });
  }

  return (
    <div className={cn(dashCard, "mt-6")}>
      <h3 className={dashHeading}>
        <BriefcaseIcon className="size-[18px] text-primary" /> Exchange Hub Opportunities
      </h3>
      {opportunities.length === 0 ? (
        <p className="p-8 text-center text-[13px] text-text-muted">
          No opportunities awaiting a deal or approval right now.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {opportunities.map((o) => (
            <div key={o.id} className="rounded-xl border border-line bg-bg-primary p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-[14.5px] font-bold text-text-main">{o.articleTitle}</span>
                    <span className="rounded bg-primary-glow px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
                      {TYPE_LABEL[o.type] ?? o.type}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-text-muted">By {o.authorName} — {o.description}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                    o.status === "agreement_pending" ? "bg-warning/10 text-warning" : "bg-primary-glow text-primary",
                  )}
                >
                  {o.status === "agreement_pending" ? "Agreement pending approval" : "Open"}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-text-muted">
                {o.expectedValue != null && <span>Expected value: {formatAUD(o.expectedValue)}</span>}
                {o.closingAt && <span>Closes: {new Date(o.closingAt).toLocaleDateString()}</span>}
              </div>

              {o.agreedBrandName ? (
                <div className="mt-3 rounded-lg border border-line bg-bg-secondary p-3 text-[12.5px]">
                  <span className="font-semibold text-text-main">
                    Agreed: {o.agreedBrandName}
                    {o.agreedValue != null && ` — ${formatAUD(o.agreedValue)}`}
                  </span>
                  {o.agreedTerms && <div className="mt-1 text-text-muted">{o.agreedTerms}</div>}
                </div>
              ) : null}

              <div className="mt-3 flex gap-2">
                {o.status !== "agreement_pending" ? (
                  <Button size="sm" disabled={isPending} onClick={() => setAgreeingOn(o)}>
                    Record Agreement
                  </Button>
                ) : (
                  <Button size="sm" disabled={isPending} onClick={() => doApprove(o.id)}>
                    Approve &amp; Publish
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPending}
                  className="border-[rgba(239,68,68,0.2)] text-danger"
                  onClick={() => doReject(o.id)}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {agreeingOn && (
        <AgreementModal
          opportunity={agreeingOn}
          pending={isPending}
          onClose={() => setAgreeingOn(null)}
          onSubmit={(data) => {
            startTransition(async () => {
              const res = await recordExchangeAgreement({ opportunityId: agreeingOn.id, ...data });
              if ("error" in res) alert(res.error);
              else {
                setAgreeingOn(null);
                refresh();
              }
            });
          }}
        />
      )}
    </div>
  );
}

function AgreementModal({
  opportunity,
  pending,
  onClose,
  onSubmit,
}: {
  opportunity: EditorOpportunity;
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: { agreedBrandName: string; agreedValue: number; agreedTerms: string }) => void;
}) {
  const [agreedBrandName, setAgreedBrandName] = useState("");
  const [agreedValue, setAgreedValue] = useState(opportunity.expectedValue?.toString() ?? "");
  const [agreedTerms, setAgreedTerms] = useState("");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(460px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-bg-secondary p-6 shadow-card">
        <h3 className="mb-1 font-heading text-lg font-bold text-text-main">Record Agreement</h3>
        <p className="mb-4 text-[12.5px] text-text-muted">
          “{opportunity.articleTitle}” — enter the deal the business and author struck. Approving afterward publishes
          the article with these terms.
        </p>

        <div className="mb-4">
          <label className={formLabel}>Brand / sponsor name</label>
          <input type="text" className={formControl} value={agreedBrandName} onChange={(e) => setAgreedBrandName(e.target.value)} />
        </div>

        <div className="mb-4">
          <label className={formLabel}>Agreed value (AUD)</label>
          <input type="number" min="0" step="1" className={formControl} value={agreedValue} onChange={(e) => setAgreedValue(e.target.value)} />
        </div>

        <div className="mb-5">
          <label className={formLabel}>Agreed terms (optional)</label>
          <textarea rows={3} className={formControl} value={agreedTerms} onChange={(e) => setAgreedTerms(e.target.value)} />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            disabled={pending || !agreedBrandName.trim() || !agreedValue.trim()}
            onClick={() =>
              onSubmit({
                agreedBrandName: agreedBrandName.trim(),
                agreedValue: Number(agreedValue),
                agreedTerms: agreedTerms.trim(),
              })
            }
          >
            {pending ? "Saving..." : "Save Agreement"}
          </Button>
        </div>
      </div>
    </>
  );
}
