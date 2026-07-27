"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { formControlSm, formLabel, workspacePanel } from "@/components/ui/Form";
import { KeyIcon, ShieldIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { useLensValue } from "@/hooks/useLensValue";
import { getAppeals, pushNotification, saveAppeals } from "@/lib/lensStore";
import { cn } from "@/lib/cn";
import type { Appeal } from "@/lib/types";

const NO_APPEALS: Appeal[] = [];

const REASONS = [
  { value: "plagiarism", label: "Inaccurate Plagiarism Flag" },
  { value: "category", label: "Category Reclassification" },
  { value: "editorial", label: "Editorial Bias / Rationale Dispute" },
  { value: "other", label: "Other policy issue" },
];

const BYLAWS = [
  {
    icon: <ShieldIcon className="size-4 align-middle text-primary" />,
    title: "Double-Blind Peer Review Policy",
    body: "To eliminate confirmation bias, MYHitch Lens utilizes double-blind evaluation protocols for research publications. Neither reviewers nor authors are disclosed during validation. Disputes are routed to senior editorial councils.",
  },
  {
    icon: <KeyIcon className="size-4 align-middle text-primary" />,
    title: "DRM Token Cryptographic Rights",
    body: "Publications are timestamped and minted with decentralized Digital Rights Management (DRM) tokens. This secures metadata, proves authorship timestamps globally, and restricts unlawful scraper extraction.",
  },
];

export default function GovernancePage() {
  const appeals = useLensValue(getAppeals, NO_APPEALS);
  const [docId, setDocId] = useState("");
  const [reason, setReason] = useState(REASONS[0].value);
  const [justify, setJustify] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedId = docId.trim();

    const next = getAppeals();
    next.unshift({
      docId: trimmedId,
      reason: reason.toUpperCase().split("_").join(" "),
      justify: justify.trim(),
      date: "Just now",
      status: "Pending Vetting",
    });
    saveAppeals(next);

    pushNotification(`Submitted dispute appeal ticket for "${trimmedId}".`);

    setDocId("");
    setJustify("");
    alert(`Dispute appeal ticket successfully registered for: ${trimmedId}.`);
  }

  return (
    <>
      <ViewHeader
        title="Governance & Copyright Policies"
        subtitle="Review peer-vetting guidelines, digital rights parameters, and submit appeals."
      />

      <div className="grid grid-cols-[1.3fr_0.7fr] gap-[30px] max-[992px]:grid-cols-1">
        {/* Bylaws */}
        <div className={cn(workspacePanel, "flex flex-col gap-6")}>
          {BYLAWS.map((bylaw) => (
            <div
              key={bylaw.title}
              className="rounded-lg border border-line bg-bg-secondary p-6 max-[480px]:p-4"
            >
              <h3 className="mb-3 flex items-center gap-2 font-heading text-base leading-[1.25] font-bold text-text-main">
                {bylaw.icon} {bylaw.title}
              </h3>
              <p className="text-[13.5px] leading-[1.7] text-text-muted">{bylaw.body}</p>
            </div>
          ))}

          {/* Appeals Log */}
          <div>
            <h3 className="mb-3 font-heading text-[15px] font-bold text-text-main">
              Active Resolution Disputes
            </h3>
            <div className="flex flex-col gap-2.5">
              {appeals.length === 0 ? (
                <p className="p-4 text-center text-[12.5px] text-text-muted">
                  No dispute tickets submitted.
                </p>
              ) : (
                appeals.map((appeal, index) => (
                  /* `.appeals-log-card` */
                  <div
                    key={`${appeal.docId}-${index}`}
                    className="flex flex-col gap-1.5 rounded-lg border border-line bg-bg-primary p-4 text-[13px]"
                  >
                    <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-1 text-[11px]">
                      <strong>ID Reference: {appeal.docId}</strong>
                      <span className="rounded-[10px] bg-accent px-1.5 py-px text-[11px] font-bold text-white">
                        {appeal.status}
                      </span>
                    </div>
                    <span className="mt-1 text-[12.5px] font-semibold text-text-main">
                      Dispute: {appeal.reason}
                    </span>
                    <p className="text-xs leading-[1.4] text-text-muted">
                      {appeal.justify}
                    </p>
                    <span className="text-right text-[10px] text-text-muted">
                      Filed: {appeal.date}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Appeals intake Form */}
        <div className="flex flex-col gap-6">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 rounded-xl border border-line bg-bg-secondary p-5"
          >
            <h4 className="mb-1.5 font-heading text-sm leading-[1.25] font-bold text-text-muted uppercase">
              Moderator Dispute Appeal
            </h4>
            <p className="mb-2 text-[11px] text-text-muted">
              File an appeal regarding rejected drafts, citation flags, or account
              vetting status.
            </p>

            <div>
              <label htmlFor="appealDocId" className={formLabel}>
                Article ID / Title
              </label>
              <input
                id="appealDocId"
                type="text"
                className={formControlSm}
                placeholder="e.g. rev-1 or Draft Title"
                value={docId}
                onChange={(event) => setDocId(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="appealReason" className={formLabel}>
                Dispute Reason
              </label>
              <select
                id="appealReason"
                className={formControlSm}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {REASONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="appealJustify" className={formLabel}>
                Justification details
              </label>
              <textarea
                id="appealJustify"
                rows={4}
                className={formControlSm}
                placeholder="Detail citations to support appeal..."
                value={justify}
                onChange={(event) => setJustify(event.target.value)}
                required
              />
            </div>

            <Button type="submit" size="sm" className="mt-2.5 w-full">
              Submit Appeal Ticket
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
