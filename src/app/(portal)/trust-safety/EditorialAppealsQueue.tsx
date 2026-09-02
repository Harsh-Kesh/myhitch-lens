"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { formControlSm } from "@/components/ui/Form";
import { ShieldIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

import { resolveEditorialAppeal } from "./appealActions";

const REASON_LABELS: Record<string, string> = {
  plagiarism: "Inaccurate Plagiarism Flag",
  category: "Category Reclassification",
  editorial: "Editorial Bias / Rationale Dispute",
  other: "Other policy issue",
};

export interface EditorialAppealRow {
  id: string;
  articleId: string;
  articleTitle: string;
  articleStatus: string;
  reason: string;
  justify: string;
  createdAt: string;
  authorName: string;
}

export function EditorialAppealsQueue({
  appeals,
  categories,
}: {
  appeals: EditorialAppealRow[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categoryPick, setCategoryPick] = useState<Record<string, string>>({});

  function resolve(id: string, decision: "resolve" | "deny", reason: string) {
    const note = window.prompt(
      decision === "resolve" ? "Note to the author (why you're siding with them):" : "Reason for denying this appeal:",
      "",
    );
    if (note === null) return;
    if (!note.trim()) {
      alert("A note is required.");
      return;
    }
    if (decision === "resolve" && reason === "category" && !categoryPick[id]) {
      alert("Pick a corrected category first.");
      return;
    }
    startTransition(async () => {
      const res = await resolveEditorialAppeal({
        ticketId: id,
        decision,
        note,
        newCategoryId: reason === "category" ? categoryPick[id] : undefined,
      });
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className={dashCard}>
      <h3 className={dashHeading}>
        <ShieldIcon className="size-[18px] text-primary" /> Editorial Appeals ({appeals.length})
      </h3>
      {appeals.length === 0 ? (
        <p className="p-8 text-center text-[13px] text-text-muted">No open editorial appeals.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {appeals.map((a) => (
            <div key={a.id} className="rounded-lg border border-line bg-bg-primary p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-heading text-[14.5px] font-bold text-text-main">{a.articleTitle}</span>
                  <span className="ml-2 rounded bg-bg-tertiary px-2 py-0.5 text-[10px] font-semibold text-text-muted uppercase">
                    {a.articleStatus}
                  </span>
                </div>
                <span className="text-[11px] text-text-muted">
                  by {a.authorName} · {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="mb-2 text-[11px] font-bold tracking-wide text-primary uppercase">
                {REASON_LABELS[a.reason] ?? a.reason}
              </div>
              <p className="mb-3 rounded bg-bg-tertiary px-3 py-2 text-[12.5px] text-text-muted">{a.justify}</p>

              {a.reason === "category" && (
                <select
                  className={cn(formControlSm, "mb-3 max-w-xs")}
                  value={categoryPick[a.id] ?? ""}
                  onChange={(e) => setCategoryPick((c) => ({ ...c, [a.id]: e.target.value }))}
                >
                  <option value="">Corrected category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              <div className="flex flex-wrap gap-3">
                <Button size="sm" disabled={isPending} onClick={() => resolve(a.id, "resolve", a.reason)}>
                  Resolve in author&rsquo;s favor
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPending}
                  className="border-[rgba(239,68,68,0.2)] text-danger"
                  onClick={() => resolve(a.id, "deny", a.reason)}
                >
                  Deny appeal
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
