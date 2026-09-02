"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { formControl } from "@/components/ui/Form";
import { dashHeading } from "@/components/ui/DashboardKit";
import { cn } from "@/lib/cn";
import type { RemovedArticle } from "@/lib/dashboard";
import { appealTakedown, fileEditorialAppeal, type EditorialAppealReason } from "../article/actions";

const EDITORIAL_REASONS: { value: EditorialAppealReason; label: string }[] = [
  { value: "editorial", label: "Editorial Bias / Rationale Dispute" },
  { value: "plagiarism", label: "Inaccurate Plagiarism Flag" },
  { value: "category", label: "Category Reclassification" },
  { value: "other", label: "Other policy issue" },
];

function StatusBadge({ tone, children }: { tone: "warning" | "success" | "danger"; children: React.ReactNode }) {
  const toneClass =
    tone === "warning" ? "bg-warning/10 text-warning" : tone === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger";
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", toneClass)}>{children}</span>;
}

export function RemovedArticles({ items, strikes }: { items: RemovedArticle[]; strikes: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [reason, setReason] = useState<EditorialAppealReason>("editorial");

  if (items.length === 0) return null;

  function openForm(id: string, defaultReason: EditorialAppealReason) {
    setOpenId(id);
    setReason(defaultReason);
    setText("");
  }
  function closeForm() {
    setOpenId(null);
    setText("");
  }

  function submitCopyrightAppeal(articleId: string) {
    const body = text.trim();
    if (!body) return;
    startTransition(async () => {
      const res = await appealTakedown(articleId, body);
      if ("error" in res) alert(res.error);
      else {
        closeForm();
        router.refresh();
      }
    });
  }

  function submitEditorialAppeal(articleId: string) {
    const body = text.trim();
    if (!body) return;
    startTransition(async () => {
      const res = await fileEditorialAppeal({ articleId, reason, justify: body });
      if ("error" in res) alert(res.error);
      else {
        closeForm();
        router.refresh();
      }
    });
  }

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className={dashHeading}>
          <svg className="size-[18px] text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Removed Articles
        </h3>
        {strikes > 0 && (
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", strikes >= 3 ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")}>
            {strikes} copyright strike{strikes === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-danger/30 bg-danger/5 p-4">
            <div className="mb-1 font-semibold text-text-main">{item.title}</div>
            <p className="mb-2 text-[12px] text-text-muted">
              {item.kind === "copyright"
                ? `Removed following a copyright report: “${item.reason}”`
                : `Rejected by an editor: “${item.reason}”`}
            </p>

            {item.appealStatus === "none" && (
              openId === item.id ? (
                <div className="mt-2">
                  {item.kind === "editorial" && (
                    <select
                      className={cn(formControl, "mb-2")}
                      value={reason}
                      onChange={(e) => setReason(e.target.value as EditorialAppealReason)}
                    >
                      {EDITORIAL_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  )}
                  <textarea
                    rows={3}
                    className={cn(formControl, "mb-2")}
                    placeholder={
                      item.kind === "copyright"
                        ? "Explain why this removal should be reversed (e.g. you own the rights, it's a misunderstanding)…"
                        : "Explain why this decision should be reconsidered…"
                    }
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={closeForm}>Cancel</Button>
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => (item.kind === "copyright" ? submitCopyrightAppeal(item.id) : submitEditorialAppeal(item.id))}
                    >
                      {isPending ? "Submitting..." : "Submit Appeal"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => openForm(item.id, "editorial")}>Appeal this decision</Button>
              )
            )}

            {item.kind === "copyright" ? (
              <>
                {item.appealStatus === "pending" && <StatusBadge tone="warning">Appeal pending review</StatusBadge>}
                {item.appealStatus === "upheld" && <StatusBadge tone="success">Appeal upheld — article reinstated</StatusBadge>}
                {item.appealStatus === "denied" && <StatusBadge tone="danger">Appeal denied — removal stands</StatusBadge>}
              </>
            ) : (
              <>
                {(item.appealStatus === "open" || item.appealStatus === "under_review") && (
                  <StatusBadge tone="warning">Appeal pending review</StatusBadge>
                )}
                {item.appealStatus === "resolved" && <StatusBadge tone="success">Appeal resolved in your favor</StatusBadge>}
                {item.appealStatus === "rejected" && <StatusBadge tone="danger">Appeal denied — decision stands</StatusBadge>}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
