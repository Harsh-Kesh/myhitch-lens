"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { BookIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import type { IssueArticleRow, MagazineIssue } from "@/lib/magazine";

import { setMagazineFeature } from "./actions";

const SLOTS = [1, 2, 3] as const;

export function MagazineCuration({
  issue,
  articles,
  weekOffset,
  isCurrentWeek,
}: {
  issue: MagazineIssue;
  articles: IssueArticleRow[];
  weekOffset: number;
  isCurrentWeek: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setFeature(articleId: string, order: 1 | 2 | 3 | null) {
    startTransition(async () => {
      const res = await setMagazineFeature(articleId, order);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  const featured = SLOTS.map((slot) => articles.find((a) => a.isFeatured && a.featureOrder === slot) ?? null);
  const regular = articles.filter((a) => !a.isFeatured);

  return (
    <>
      <ViewHeader
        title="Magazine Curation"
        subtitle="Pick the first 3 pages of this week's MYHitch Magazine. Every other page follows publish order — earlier publishing earns an earlier page."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/magazine?week=${weekOffset - 1}`}
              className="rounded-lg border border-line bg-bg-secondary px-3 py-1.5 text-xs font-semibold text-text-muted hover:border-line-hover hover:text-text-main"
            >
              ← Prev week
            </Link>
            <span className="rounded-lg bg-bg-tertiary px-3 py-1.5 text-xs font-semibold text-text-main">
              {issue.weekLabel} {isCurrentWeek && <span className="text-primary">(this week)</span>}
            </span>
            <Link
              href={`/magazine?week=${weekOffset + 1}`}
              className="rounded-lg border border-line bg-bg-secondary px-3 py-1.5 text-xs font-semibold text-text-muted hover:border-line-hover hover:text-text-main"
            >
              Next week →
            </Link>
          </div>
        }
      />

      {/* Featured slots (first 3 pages) */}
      <div className="mb-6">
        <h3 className={dashHeading}>
          <BookIcon className="size-[18px] text-primary" /> Pages 1–3 — Team Picks
        </h3>
        <div className="grid grid-cols-3 gap-4 max-[768px]:grid-cols-1">
          {SLOTS.map((slot, i) => {
            const a = featured[i];
            return (
              <div key={slot} className={cn(dashCard, "flex flex-col")}>
                <div className="mb-2 text-[11px] font-bold text-primary uppercase">Page {slot}</div>
                {a ? (
                  <>
                    <Link href={`/article?id=${a.id}`} className="mb-1 font-heading text-[14.5px] font-bold text-text-main hover:text-primary">
                      {a.title}
                    </Link>
                    <p className="mb-3 text-[11.5px] text-text-muted">By {a.author}</p>
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setFeature(a.id, null)} className="mt-auto">
                      Remove from Page {slot}
                    </Button>
                  </>
                ) : (
                  <p className="mt-2 text-center text-[12px] text-text-muted">Empty slot — feature an article below.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Regular pages, in publish order */}
      <div className={dashCard}>
        <h3 className={dashHeading}>
          <BookIcon className="size-[18px] text-primary" /> Pages 4+ — By Publish Time ({regular.length})
        </h3>
        {articles.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-text-muted">No articles publish in this week’s issue.</p>
        ) : regular.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-text-muted">Every article this week is currently featured.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {regular.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-bg-primary px-4 py-3">
                <div className="min-w-0">
                  <span className="mr-2 text-[11px] font-bold text-text-muted">Page {a.page}</span>
                  <Link href={`/article?id=${a.id}`} className="font-semibold text-text-main hover:text-primary">
                    {a.title}
                  </Link>
                  <span className="ml-2 text-[11.5px] text-text-muted">
                    by {a.author} · {new Date(a.publishedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {SLOTS.map((slot) => (
                    <Button key={slot} size="sm" variant="secondary" disabled={isPending} onClick={() => setFeature(a.id, slot)}>
                      Feature: Page {slot}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
