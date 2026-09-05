"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { ShoppingCartIcon } from "@/components/ui/icons";
import type { ExternalOpportunityView } from "@/lib/externalOpportunities";

import { expressInterest } from "./externalActions";

function formatAUD(n: number): string {
  return `A$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Author-facing: briefs posted by MYHitch Mart (or any other MYHitch product) looking for a writer. */
export function ExternalOpportunitiesBoard({ opportunities }: { opportunities: ExternalOpportunityView[] }) {
  const [isPending, startTransition] = useTransition();
  const [interested, setInterested] = useState<Set<string>>(new Set());

  function doExpressInterest(id: string) {
    startTransition(async () => {
      const res = await expressInterest(id);
      if ("error" in res) alert(res.error);
      else setInterested((prev) => new Set(prev).add(id));
    });
  }

  if (opportunities.length === 0) return null;

  return (
    <div className={dashCard}>
      <h3 className={dashHeading}>
        <ShoppingCartIcon className="size-[18px] text-primary" /> Opportunities from MYHitch Mart &amp; Partners
      </h3>
      <p className="mb-4 text-[12.5px] text-text-muted">
        Other MYHitch products sometimes need an article written about one of their products or launches. Pick one up
        if it's a fit.
      </p>
      <div className="flex flex-col gap-4">
        {opportunities.map((o) => (
          <div key={o.id} className="rounded-xl border border-line bg-bg-primary p-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-[14.5px] font-bold text-text-main">{o.title}</span>
                  <span className="rounded bg-primary-glow px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
                    {o.platform}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-text-muted">{o.description}</p>
              </div>
              {o.expectedValue != null && (
                <span className="shrink-0 text-[11.5px] font-semibold text-text-muted">{formatAUD(o.expectedValue)}</span>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending || interested.has(o.id)}
              onClick={() => doExpressInterest(o.id)}
            >
              {interested.has(o.id) ? "Interest sent" : "I'm interested"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
