"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import { dashCard, dashHeading, StatChip } from "@/components/ui/DashboardKit";
import { Modal } from "@/components/ui/Modal";
import { BriefcaseIcon, ClockIcon, CheckCircleIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import type { AuthorOpportunity, ExchangeListableArticle } from "@/lib/exchange";
import type { ExchangeOpportunityType } from "@prisma/client";

import { cancelExchangeSubmission, revertToMainApp, submitToExchangeHub } from "./actions";

const TYPE_LABEL: Record<ExchangeOpportunityType, string> = {
  sponsorship: "Sponsorship",
  advertising: "Advertising",
  bidding: "Bidding",
  partnership: "Partnership",
  collaboration: "Commercial Collaboration",
  other: "Other",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open — awaiting a business",
  in_negotiation: "In negotiation",
  agreement_pending: "Agreement pending approval",
  approved: "Approved",
  published: "Published with agreed terms",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function formatAUD(n: number): string {
  return `A$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ExchangeHub({
  listable,
  opportunities,
}: {
  listable: ExchangeListableArticle[];
  opportunities: AuthorOpportunity[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showSubmit, setShowSubmit] = useState(false);

  const openCount = opportunities.filter((o) => ["open", "in_negotiation", "agreement_pending"].includes(o.status)).length;
  const publishedCount = opportunities.filter((o) => o.status === "published").length;

  function refresh() {
    router.refresh();
  }

  function doCancel(id: string) {
    if (!confirm("Withdraw this submission? The article returns to the normal editorial queue.")) return;
    startTransition(async () => {
      const res = await cancelExchangeSubmission(id);
      if ("error" in res) alert(res.error);
      else refresh();
    });
  }

  function doRevert(id: string) {
    if (!confirm("Revert this article to the regular MYHitch Lens feed? It stays published, just no longer marked as an Exchange Hub sponsorship.")) return;
    startTransition(async () => {
      const res = await revertToMainApp(id);
      if ("error" in res) alert(res.error);
      else refresh();
    });
  }

  return (
    <>
      <ViewHeader
        title="Exchange Hub"
        subtitle="Route an unpublished article to MYHitch's cross-platform commercial exchange — sponsorship, advertising, bidding, or partnership opportunities are reviewed by MYHitch and matched with a business before the article goes live."
        actions={
          <Button size="sm" onClick={() => setShowSubmit(true)} disabled={listable.length === 0}>
            Submit to Exchange Hub
          </Button>
        }
      />

      {listable.length === 0 && opportunities.length === 0 && (
        <p className="mb-4 text-[12.5px] text-text-muted">
          You don&apos;t have an unpublished draft or in-review article yet — write one first, then you can offer it
          here before publishing.
        </p>
      )}

      <div className="mb-6 grid grid-cols-3 gap-4 max-[560px]:grid-cols-1">
        <StatChip icon={<BriefcaseIcon className="size-4" />} value={opportunities.length} label="Total submissions" />
        <StatChip icon={<ClockIcon className="size-4" />} value={openCount} label="In progress" />
        <StatChip icon={<CheckCircleIcon className="size-4" />} value={publishedCount} label="Published via Exchange" accent />
      </div>

      <div className={dashCard}>
        <h3 className={dashHeading}>
          <BriefcaseIcon className="size-[18px] text-primary" /> Your Submissions
        </h3>
        {opportunities.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-text-muted">
            No Exchange Hub submissions yet.
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
                    <p className="mt-1 text-[12px] text-text-muted">{o.description}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                      (o.status === "open" || o.status === "in_negotiation") && "bg-primary-glow text-primary",
                      o.status === "agreement_pending" && "bg-warning/10 text-warning",
                      o.status === "published" && "bg-success/10 text-success",
                      (o.status === "rejected" || o.status === "cancelled") && "bg-danger/10 text-danger",
                    )}
                  >
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-text-muted">
                  {o.expectedValue != null && <span>Expected value: {formatAUD(o.expectedValue)}</span>}
                  {o.closingAt && <span>Closes: {new Date(o.closingAt).toLocaleDateString()}</span>}
                </div>

                {o.agreedBrandName && (
                  <div className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3 text-[12.5px]">
                    <span className="font-semibold text-success">
                      Agreed with {o.agreedBrandName}
                      {o.agreedValue != null && ` for ${formatAUD(o.agreedValue)}`}
                    </span>
                    {o.agreedTerms && <div className="mt-1 text-text-muted">Terms: {o.agreedTerms}</div>}
                  </div>
                )}

                {["open", "in_negotiation", "agreement_pending"].includes(o.status) && (
                  <div className="mt-3">
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => doCancel(o.id)}>
                      Withdraw Submission
                    </Button>
                  </div>
                )}

                {o.status === "published" && (
                  <div className="mt-3">
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => doRevert(o.id)}>
                      Revert to Main App
                    </Button>
                    <p className="mt-1.5 text-[11px] text-text-muted">
                      Stays published — just no longer marked as an Exchange Hub sponsorship.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showSubmit && (
        <SubmitModal
          listable={listable}
          pending={isPending}
          onClose={() => setShowSubmit(false)}
          onSubmit={(data) => {
            startTransition(async () => {
              const res = await submitToExchangeHub(data);
              if ("error" in res) alert(res.error);
              else {
                setShowSubmit(false);
                refresh();
              }
            });
          }}
        />
      )}
    </>
  );
}

function SubmitModal({
  listable,
  pending,
  onClose,
  onSubmit,
}: {
  listable: ExchangeListableArticle[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: {
    articleId: string;
    type: ExchangeOpportunityType;
    description: string;
    expectedValue: number | null;
    closingAt: string | null;
    brandPlacementNotes: string;
    sponsorAckRequirements: string;
    commercialConditions: string;
  }) => void;
}) {
  const [articleId, setArticleId] = useState(listable[0]?.id ?? "");
  const [type, setType] = useState<ExchangeOpportunityType>("sponsorship");
  const [description, setDescription] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [closingAt, setClosingAt] = useState("");
  const [brandPlacementNotes, setBrandPlacementNotes] = useState("");
  const [sponsorAckRequirements, setSponsorAckRequirements] = useState("");
  const [commercialConditions, setCommercialConditions] = useState("");

  return (
    <Modal onClose={onClose} className="w-[min(520px,92vw)]">
        <h3 className="mb-1 font-heading text-lg font-bold text-text-main">Submit to Exchange Hub</h3>
        <p className="mb-4 text-[12.5px] text-text-muted">
          The article is held back from publication while MYHitch matches it with a business. It publishes
          automatically once an agreement is approved.
        </p>

        <div className="mb-4">
          <label className={formLabel}>Article</label>
          <select className={formControl} value={articleId} onChange={(e) => setArticleId(e.target.value)}>
            {listable.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className={formLabel}>Opportunity type</label>
          <select className={formControl} value={type} onChange={(e) => setType(e.target.value as ExchangeOpportunityType)}>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className={formLabel}>Description (shown to reviewing businesses)</label>
          <textarea
            rows={3}
            className={formControl}
            placeholder="What's the article about, and what are you offering?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className={formLabel}>Expected value (AUD, optional)</label>
            <input type="number" min="0" step="1" className={formControl} value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} />
          </div>
          <div>
            <label className={formLabel}>Submission closes (optional)</label>
            <input type="date" className={formControl} value={closingAt} onChange={(e) => setClosingAt(e.target.value)} />
          </div>
        </div>

        <div className="mb-4">
          <label className={formLabel}>Brand/logo placement notes (optional)</label>
          <textarea rows={2} className={formControl} value={brandPlacementNotes} onChange={(e) => setBrandPlacementNotes(e.target.value)} />
        </div>

        <div className="mb-4">
          <label className={formLabel}>Sponsor acknowledgement requirements (optional)</label>
          <textarea rows={2} className={formControl} value={sponsorAckRequirements} onChange={(e) => setSponsorAckRequirements(e.target.value)} />
        </div>

        <div className="mb-5">
          <label className={formLabel}>Other commercial conditions (optional)</label>
          <textarea rows={2} className={formControl} value={commercialConditions} onChange={(e) => setCommercialConditions(e.target.value)} />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            disabled={pending || !articleId || !description.trim()}
            onClick={() =>
              onSubmit({
                articleId,
                type,
                description: description.trim(),
                expectedValue: expectedValue.trim() ? Number(expectedValue) : null,
                closingAt: closingAt || null,
                brandPlacementNotes,
                sponsorAckRequirements,
                commercialConditions,
              })
            }
          >
            {pending ? "Submitting..." : "Submit"}
          </Button>
        </div>
    </Modal>
  );
}
