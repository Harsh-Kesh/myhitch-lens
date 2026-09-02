"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { formControlSm, formLabel, workspacePanel } from "@/components/ui/Form";
import { KeyIcon, ShieldIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import { fileEditorialAppeal, type EditorialAppealReason } from "../article/actions";

const REASONS: { value: EditorialAppealReason; label: string }[] = [
  { value: "plagiarism", label: "Inaccurate Plagiarism Flag" },
  { value: "category", label: "Category Reclassification" },
  { value: "editorial", label: "Editorial Bias / Rationale Dispute" },
  { value: "other", label: "Other policy issue" },
];

const REASON_LABELS: Record<string, string> = Object.fromEntries(REASONS.map((r) => [r.value, r.label]));

const STATUS_PRESENTATION: Record<string, { label: string; tone: string }> = {
  open: { label: "Pending review", tone: "bg-warning/10 text-warning" },
  under_review: { label: "Under review", tone: "bg-warning/10 text-warning" },
  resolved: { label: "Resolved in your favor", tone: "bg-success/10 text-success" },
  rejected: { label: "Denied", tone: "bg-danger/10 text-danger" },
};

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

interface AppealRow {
  id: string;
  subject: string;
  reason: string;
  justify: string;
  status: string;
  createdAt: string;
}

export function GovernanceCenter({
  articles,
  appeals,
}: {
  articles: { id: string; title: string }[];
  appeals: AppealRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [articleId, setArticleId] = useState(articles[0]?.id ?? "");
  const [reason, setReason] = useState<EditorialAppealReason>(REASONS[0].value);
  const [justify, setJustify] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!articleId) return;
    startTransition(async () => {
      const res = await fileEditorialAppeal({ articleId, reason, justify });
      if ("error" in res) {
        alert(res.error);
        return;
      }
      setJustify("");
      router.refresh();
    });
  }

  return (
    <>
      <ViewHeader
        title="Governance & Copyright Policies"
        subtitle="Review peer-vetting guidelines, digital rights parameters, and file appeals on editorial decisions."
      />

      <div className="grid grid-cols-[1.3fr_0.7fr] gap-[30px] max-[992px]:grid-cols-1">
        {/* Bylaws */}
        <div className={cn(workspacePanel, "flex flex-col gap-6")}>
          {BYLAWS.map((bylaw) => (
            <div key={bylaw.title} className="rounded-lg border border-line bg-bg-secondary p-6 max-[480px]:p-4">
              <h3 className="mb-3 flex items-center gap-2 font-heading text-base leading-[1.25] font-bold text-text-main">
                {bylaw.icon} {bylaw.title}
              </h3>
              <p className="text-[13.5px] leading-[1.7] text-text-muted">{bylaw.body}</p>
            </div>
          ))}

          {/* Appeals Log */}
          <div>
            <h3 className="mb-3 font-heading text-[15px] font-bold text-text-main">Your Appeals</h3>
            <div className="flex flex-col gap-2.5">
              {appeals.length === 0 ? (
                <p className="p-4 text-center text-[12.5px] text-text-muted">You haven&rsquo;t filed any appeals.</p>
              ) : (
                appeals.map((appeal) => {
                  const presentation = STATUS_PRESENTATION[appeal.status] ?? { label: appeal.status, tone: "bg-bg-tertiary text-text-muted" };
                  const title = appeal.subject.split(" — ").slice(1).join(" — ") || appeal.subject;
                  return (
                    <div key={appeal.id} className="flex flex-col gap-1.5 rounded-lg border border-line bg-bg-primary p-4 text-[13px]">
                      <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-1 text-[11px]">
                        <strong>{title}</strong>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", presentation.tone)}>
                          {presentation.label}
                        </span>
                      </div>
                      <span className="mt-1 text-[12.5px] font-semibold text-text-main">
                        {REASON_LABELS[appeal.reason] ?? appeal.reason}
                      </span>
                      <p className="text-xs leading-[1.4] text-text-muted">{appeal.justify}</p>
                      <span className="text-right text-[10px] text-text-muted">
                        Filed: {new Date(appeal.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Appeals intake Form */}
        <div className="flex flex-col gap-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-line bg-bg-secondary p-5">
            <h4 className="mb-1.5 font-heading text-sm leading-[1.25] font-bold text-text-muted uppercase">
              Editorial Appeal
            </h4>
            <p className="mb-2 text-[11px] text-text-muted">
              File an appeal about one of your own articles — a rejected draft, an inaccurate plagiarism flag, or a
              category you think is wrong. Editors see this in their Trust &amp; Safety queue.
            </p>

            {articles.length === 0 ? (
              <p className="rounded-md border border-line bg-bg-primary p-3 text-[12px] text-text-muted">
                You don&rsquo;t have any articles to appeal about yet.
              </p>
            ) : (
              <>
                <div>
                  <label htmlFor="appealArticle" className={formLabel}>Article</label>
                  <select
                    id="appealArticle"
                    className={formControlSm}
                    value={articleId}
                    onChange={(event) => setArticleId(event.target.value)}
                  >
                    {articles.map((a) => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="appealReason" className={formLabel}>Dispute Reason</label>
                  <select
                    id="appealReason"
                    className={formControlSm}
                    value={reason}
                    onChange={(event) => setReason(event.target.value as EditorialAppealReason)}
                  >
                    {REASONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="appealJustify" className={formLabel}>Justification details</label>
                  <textarea
                    id="appealJustify"
                    rows={4}
                    className={formControlSm}
                    placeholder="Explain the issue so an editor can act on it..."
                    value={justify}
                    onChange={(event) => setJustify(event.target.value)}
                    required
                  />
                </div>

                <Button type="submit" size="sm" className="mt-2.5 w-full" disabled={isPending}>
                  {isPending ? "Submitting..." : "Submit Appeal"}
                </Button>
              </>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
