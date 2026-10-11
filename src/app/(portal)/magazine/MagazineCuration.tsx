"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { BookIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import type { IssueArticleRow, MagazineIssue } from "@/lib/magazine";
import { MAGAZINE_PAGES, MAGAZINE_SECTIONS, formatPageRange } from "@/lib/magazineLayout";
import { PLANS } from "@/lib/plans";

import { setMagazineFeature } from "./actions";

const SLOTS = [1, 2, 3] as const;

/** The blocks of the 128-page issue that author articles can fill. */
const AUTHOR_SECTIONS = [MAGAZINE_SECTIONS.premium, MAGAZINE_SECTIONS.middle, MAGAZINE_SECTIONS.contributors];

const linkButton =
  "rounded-lg border border-line bg-bg-secondary px-3 py-1.5 text-xs font-semibold text-text-muted hover:border-line-hover hover:text-text-main";

export function MagazineCuration({
  issue,
  articles,
  monthOffset,
  isCurrentIssue,
}: {
  issue: MagazineIssue;
  articles: IssueArticleRow[];
  monthOffset: number;
  isCurrentIssue: boolean;
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

  const placed = articles.filter((a) => a.pageStart !== null);
  const waiting = articles.filter((a) => a.pageStart === null);

  return (
    <>
      <ViewHeader
        title="Magazine Curation"
        subtitle="One 128-page MYHitch Lens magazine a month. Each plan's articles fill the pages that plan is eligible for; pick a lead article to put it ahead of the others on those pages."
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/magazine?month=${monthOffset - 1}`} className={linkButton}>
              ← Prev month
            </Link>
            <span className="rounded-lg bg-bg-tertiary px-3 py-1.5 text-xs font-semibold text-text-main">
              {issue.label} {isCurrentIssue && <span className="text-primary">(this month)</span>}
            </span>
            <Link href={`/magazine?month=${monthOffset + 1}`} className={linkButton}>
              Next month →
            </Link>
          </div>
        }
      />

      {/* How full each block of the issue is */}
      <div className="mb-6 grid grid-cols-3 gap-4 max-[768px]:grid-cols-1">
        {AUTHOR_SECTIONS.map((section) => {
          const size = section.to - section.from + 1;
          const used = placed
            .filter((a) => a.pageStart! >= section.from && a.pageStart! <= section.to)
            .reduce((sum, a) => sum + (a.pageEnd! - a.pageStart! + 1), 0);
          return (
            <div key={section.label} className={dashCard}>
              <div className="text-[11px] font-bold text-primary uppercase">{section.label}</div>
              <div className="mt-1 font-heading text-lg font-bold text-text-main">
                Pages {formatPageRange(section.from, section.to)}
              </div>
              <div className="text-[11.5px] text-text-muted">
                {used} of {size} pages filled
              </div>
            </div>
          );
        })}
      </div>
      <p className="mb-6 text-[11.5px] text-text-muted">
        Pages {formatPageRange(MAGAZINE_SECTIONS.editorial.from, MAGAZINE_SECTIONS.editorial.to)} (cover, contents,
        editor&apos;s message) and {formatPageRange(MAGAZINE_SECTIONS.closing.from, MAGAZINE_SECTIONS.closing.to)}{" "}
        (approved sponsors and back cover) are MYHitch&apos;s own, out of {MAGAZINE_PAGES}.
      </p>

      <div className={dashCard}>
        <h3 className={dashHeading}>
          <BookIcon className="size-[18px] text-primary" /> This issue, page by page ({placed.length})
        </h3>
        {articles.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-text-muted">No articles published in this month&rsquo;s issue.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {[...placed, ...waiting].map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-bg-primary px-4 py-3">
                <div className="min-w-0">
                  <span className="mr-2 text-[11px] font-bold text-text-muted">
                    {a.pageStart === null ? "Waiting" : `Page ${formatPageRange(a.pageStart, a.pageEnd!)}`}
                  </span>
                  <Link href={`/article?id=${a.id}`} className="font-semibold text-text-main hover:text-primary">
                    {a.title}
                  </Link>
                  <span className="ml-2 text-[11.5px] text-text-muted">
                    by {a.author} · {PLANS[a.plan].name} · {new Date(a.publishedAt).toLocaleString()}
                  </span>
                  {a.pageStart === null && (
                    <span className="ml-2 text-[11.5px] text-warning">
                      {PLANS[a.plan].name} pages are full this issue.
                    </span>
                  )}
                  {a.isFeatured && <span className="ml-2 text-[11px] font-bold text-primary">★ Lead pick {a.featureOrder}</span>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {a.isFeatured ? (
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setFeature(a.id, null)}>
                      Remove lead pick
                    </Button>
                  ) : (
                    SLOTS.map((slot) => (
                      <Button key={slot} size="sm" variant="secondary" disabled={isPending} onClick={() => setFeature(a.id, slot)}>
                        Lead pick {slot}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
