"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { formControl, formLabel } from "@/components/ui/Form";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import type { ExternalOpportunityView } from "@/lib/externalOpportunities";

import { createExternalOpportunity, deactivateExternalOpportunity } from "./externalActions";

function formatAUD(n: number): string {
  return `A$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Admin-only: post and manage briefs from MYHitch Mart / other MYHitch products for authors to pick up. */
export function ExternalOpportunitiesAdmin({ opportunities }: { opportunities: ExternalOpportunityView[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [platform, setPlatform] = useState("MYHitch Mart");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createExternalOpportunity({
        platform,
        title,
        description,
        category: category || undefined,
        expectedValue: expectedValue.trim() ? Number(expectedValue) : null,
      });
      if ("error" in res) setError(res.error);
      else {
        setTitle("");
        setDescription("");
        setCategory("");
        setExpectedValue("");
        router.refresh();
      }
    });
  }

  function doDeactivate(id: string) {
    if (!confirm("Take this listing down? Authors will no longer see it.")) return;
    startTransition(async () => {
      await deactivateExternalOpportunity(id);
      router.refresh();
    });
  }

  return (
    <>
      <ViewHeader
        title="External Opportunities"
        subtitle="Post briefs from MYHitch Mart or any other MYHitch product for authors to pick up in the Exchange Hub."
      />

      <div className={cn(dashCard, "mb-6")}>
        <h3 className={dashHeading}>Post a new opportunity</h3>
        <div className="mb-3 grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
          <div>
            <label className={formLabel}>Platform</label>
            <input className={formControl} value={platform} onChange={(e) => setPlatform(e.target.value)} />
          </div>
          <div>
            <label className={formLabel}>Category (optional)</label>
            <input className={formControl} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Supply Chain" />
          </div>
        </div>
        <div className="mb-3">
          <label className={formLabel}>Title</label>
          <input className={formControl} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className={formLabel}>Description</label>
          <textarea rows={3} className={formControl} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="mb-4">
          <label className={formLabel}>Expected value (AUD, optional)</label>
          <input type="number" min="0" step="1" className={formControl} value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} />
        </div>
        {error && <p className="mb-3 text-[12.5px] text-danger">{error}</p>}
        <Button disabled={isPending || !title.trim() || !description.trim()} onClick={submit}>
          {isPending ? "Posting..." : "Post opportunity"}
        </Button>
      </div>

      <div className={dashCard}>
        <h3 className={dashHeading}>All listings</h3>
        {opportunities.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-text-muted">Nothing posted yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {opportunities.map((o) => (
              <div key={o.id} className="rounded-lg border border-line bg-bg-primary p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-[14px] font-bold text-text-main">{o.title}</span>
                    <span className="rounded bg-bg-tertiary px-2 py-0.5 text-[10px] font-bold text-text-muted uppercase">{o.platform}</span>
                    {!o.isActive && <span className="rounded bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger uppercase">Inactive</span>}
                  </div>
                  {o.expectedValue != null && <span className="text-[11.5px] font-semibold text-text-muted">{formatAUD(o.expectedValue)}</span>}
                </div>
                <p className="mb-2 text-[12px] text-text-muted">{o.description}</p>
                {o.isActive && (
                  <Button size="sm" variant="secondary" disabled={isPending} onClick={() => doDeactivate(o.id)}>
                    Take down
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
