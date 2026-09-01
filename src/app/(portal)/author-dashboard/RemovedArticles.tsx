"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { formControl } from "@/components/ui/Form";
import { dashHeading } from "@/components/ui/DashboardKit";
import { cn } from "@/lib/cn";
import type { RemovedArticle } from "@/lib/dashboard";
import { appealTakedown } from "../article/actions";

export function RemovedArticles({ items, strikes }: { items: RemovedArticle[]; strikes: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");

  if (items.length === 0) return null;

  function submitAppeal(articleId: string) {
    const body = text.trim();
    if (!body) return;
    startTransition(async () => {
      const res = await appealTakedown(articleId, body);
      if ("error" in res) alert(res.error);
      else {
        setOpenId(null);
        setText("");
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
              Removed following a copyright report: “{item.reason}”
            </p>

            {item.appealStatus === "none" && (
              openId === item.id ? (
                <div className="mt-2">
                  <textarea
                    rows={3}
                    className={cn(formControl, "mb-2")}
                    placeholder="Explain why this removal should be reversed (e.g. you own the rights, it's a misunderstanding)…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setOpenId(null); setText(""); }}>Cancel</Button>
                    <Button size="sm" disabled={isPending} onClick={() => submitAppeal(item.id)}>
                      {isPending ? "Submitting..." : "Submit Appeal"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setOpenId(item.id)}>Appeal this decision</Button>
              )
            )}
            {item.appealStatus === "pending" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-[11px] font-bold text-warning">
                Appeal pending review
              </span>
            )}
            {item.appealStatus === "upheld" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
                Appeal upheld — article reinstated
              </span>
            )}
            {item.appealStatus === "denied" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger">
                Appeal denied — removal stands
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
