"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { getMagazineView } from "@/app/(portal)/magazine/publicActions";
import type { IssueArticleRow } from "@/lib/magazine";

/**
 * The MYHitch Lens Magazine page — a single shared component for both the
 * submit-flow preview and the real published reading view (see showMasthead).
 * Blue-and-white print typography (serif, drop caps, two-column body,
 * running head/folio) deliberately distinct from the rest of the app chrome,
 * with the MYHitch Lens logo as a faint watermark throughout and, in preview
 * only, as a literal masthead at the top of the page.
 */

// Sized to what a real magazine page actually holds in two columns of running
// text (~550-650 words), not to what looked tidy in a small mockup box.
const FIRST_PAGE_BUDGET = 2600;
const CONTINUATION_BUDGET = 3800;
const FIRST_PAGE_COLUMN_HEIGHT = 900;
const CONTINUATION_COLUMN_HEIGHT = 1150;

/** Splits text into page-sized chunks, breaking on word boundaries. */
function paginateText(text: string, firstPageBudget: number, laterPageBudget: number): string[] {
  const pages: string[] = [];
  let remaining = text.trim();
  if (!remaining) return [""];
  let index = 0;
  while (remaining.length > 0) {
    const budget = index === 0 ? firstPageBudget : laterPageBudget;
    if (remaining.length <= budget) {
      pages.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf(" ", budget);
    if (cut <= 0) cut = budget;
    pages.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
    index += 1;
  }
  return pages;
}

function rangeArray(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

function extractPlainText(json: string): string {
  try {
    const doc = JSON.parse(json);
    const parts: string[] = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== "object") return;
      const node = n as { type?: string; text?: string; content?: unknown[] };
      if (node.type === "text" && node.text) parts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(walk);
    };
    walk(doc);
    return parts.join(" ");
  } catch {
    return "";
  }
}

function isRichContent(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && parsed.type === "doc";
  } catch {
    return false;
  }
}

const pagePillBase =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full font-sans text-[11px] font-semibold transition-colors";

function NeighbourPageBlock({ piece, compact }: { piece: IssueArticleRow; compact?: boolean }) {
  const body = (
    <>
      <h3 className={cn("mb-2 font-bold tracking-[-0.01em] text-balance", compact ? "text-[19px] leading-[1.15]" : "text-[26px] leading-[1.12]")}>
        {piece.title}
      </h3>
      <div className="mb-3 text-[11.5px] tracking-[0.02em] italic text-[#0f2b5c]/70">By {piece.author}</div>
      <div
        className={cn(
          "text-[13.5px] leading-[1.65] [hyphens:auto] [text-align:justify]",
          !compact && "[column-gap:26px] [column-rule:1px_solid_rgba(15,43,92,0.14)] max-[480px]:columns-1",
        )}
        style={compact ? undefined : { columns: 2, maxHeight: CONTINUATION_COLUMN_HEIGHT, overflow: "hidden" }}
      >
        <p className={compact ? "line-clamp-3" : "first-letter:float-left first-letter:mr-2 first-letter:mt-0.5 first-letter:font-bold first-letter:text-[44px] first-letter:leading-[34px]"}>
          {piece.summary}
        </p>
      </div>
      <span className="mt-2 inline-block text-[11px] font-semibold text-[#0056b3] hover:underline">
        Read this article →
      </span>
    </>
  );

  return (
    <Link href={`/article?id=${piece.id}`} className={cn("block cursor-pointer", compact && "mt-4 border-t border-[#0f2b5c]/15 pt-4")}>
      {body}
    </Link>
  );
}

export function MagazinePage({
  title,
  content,
  author,
  category,
  articleId,
  showMasthead,
}: {
  title: string;
  content: string;
  author: string;
  category?: string;
  /** Save the draft first (or the article isn't loaded yet) — placement can't be computed. */
  articleId?: string;
  /** True in the submit-flow preview (shows the MYHitch Lens logo masthead); false on the real published page. */
  showMasthead: boolean;
}) {
  const [view, setView] = useState<Awaited<ReturnType<typeof getMagazineView>> | null | undefined>(undefined);
  const [viewPage, setViewPage] = useState<number | null>(null);

  useEffect(() => {
    if (!articleId) return;
    let cancelled = false;
    getMagazineView(articleId).then((v) => {
      if (!cancelled) setView(v);
    });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const fullText = useMemo(() => {
    const text = isRichContent(content) ? extractPlainText(content) : content;
    return text.trim();
  }, [content]);

  const articlePages = useMemo(
    () => paginateText(fullText || "Nothing written yet.", FIRST_PAGE_BUDGET, CONTINUATION_BUDGET),
    [fullText],
  );

  if (!articleId) {
    return (
      <div className="mx-auto max-w-[600px] rounded-xl border border-line bg-bg-secondary p-8 text-center text-[13px] text-text-muted">
        Save this draft first to see its magazine placement.
      </div>
    );
  }
  if (view === undefined) {
    return (
      <div className="mx-auto max-w-[600px] rounded-xl border border-line bg-bg-secondary p-8 text-center text-[13px] text-text-muted">
        Loading magazine page…
      </div>
    );
  }
  if (view === null) {
    return (
      <div className="mx-auto max-w-[600px] rounded-xl border border-line bg-bg-secondary p-8 text-center text-[13px] text-text-muted">
        Placement isn’t available for this article yet.
      </div>
    );
  }

  const { placement, issueArticles } = view;
  const startPage = placement.page;
  const endPage = startPage + articlePages.length - 1;
  const spansMultiplePages = endPage > startPage;
  const currentPage = viewPage ?? startPage;
  const withinArticle = currentPage >= startPage && currentPage <= endPage;
  const isFirstPageOfArticle = currentPage === startPage;
  const isLastPageOfArticle = currentPage === endPage;

  const minNav = Math.max(1, startPage - 2);
  const maxNav = endPage + 2;
  const railPages = rangeArray(Math.max(1, startPage - 1), endPage + 1);

  let trailingNeighbour: IssueArticleRow | undefined;
  if (withinArticle && isLastPageOfArticle) {
    const lastChunk = articlePages[articlePages.length - 1];
    const budget = articlePages.length === 1 ? FIRST_PAGE_BUDGET : CONTINUATION_BUDGET;
    if (lastChunk.length < budget * 0.65) {
      trailingNeighbour = issueArticles.find((a) => a.page === endPage + 1 && a.id !== articleId);
    }
  }
  const currentNeighbour = !withinArticle ? issueArticles.find((a) => a.page === currentPage) : undefined;

  return (
    <div className="mx-auto max-w-[600px]">
      {placement.isEstimate && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-[11.5px] text-warning">
          Estimated placement — projected as if this published right now. Your actual page depends on when you
          publish and how many other articles publish before you that week.
        </div>
      )}

      {/* Page navigation */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewPage(Math.max(minNav, currentPage - 1))}
          disabled={currentPage <= minNav}
          className="rounded-md border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-text-muted hover:border-line-hover hover:text-text-main disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Prev
        </button>
        <div className="flex items-center gap-1.5">
          {railPages.map((p) => {
            const isThisArticle = p >= startPage && p <= endPage;
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setViewPage(p)}
                title={isThisArticle ? `Page ${p} — this article` : `Page ${p} — another article`}
                className={cn(
                  pagePillBase,
                  isActive
                    ? "bg-primary text-text-inverse"
                    : isThisArticle
                      ? "bg-primary-glow text-primary hover:bg-primary/20"
                      : "bg-bg-tertiary text-text-muted hover:text-text-main",
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setViewPage(Math.min(maxNav, currentPage + 1))}
          disabled={currentPage >= maxNav}
          className="rounded-md border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-text-muted hover:border-line-hover hover:text-text-main disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>
      {spansMultiplePages && (
        <p className="mb-3 text-center text-[11px] text-text-muted">
          This piece runs {articlePages.length} pages at its current length — pages {startPage}–{endPage}.
        </p>
      )}

      {/* The physical page — blue-and-white print typography, deliberately
          distinct from the app's own chrome. */}
      <div
        className="relative mx-auto overflow-hidden rounded-[2px] bg-white text-[#0f2340] shadow-[0_1px_2px_rgba(15,43,92,0.10),0_18px_38px_rgba(15,43,92,0.16)] ring-1 ring-[#0f2b5c]/10"
        style={{ fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif" }}
      >
        {/* Watermark — faint, behind everything */}
        <div
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative watermark, no need for next/image optimization */}
          <img src="/images/myhitch-logo.jpeg" alt="" className="w-[95%] max-w-[480px] opacity-[0.06] mix-blend-multiply" />
        </div>

        <div className="relative z-10 px-9 pt-7 pb-5 max-[480px]:px-6">
          {showMasthead && (
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#0f2b5c]/70 pb-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- masthead logo, preview only */}
              <img src="/images/logo.png" alt="MYHitch Lens Magazine" className="h-9 w-auto" />
              <span className="font-sans text-[10px] tracking-[0.1em] text-[#0f2b5c]/60 uppercase">{placement.issue.weekLabel}</span>
            </div>
          )}

          {withinArticle ? (
            isFirstPageOfArticle ? (
              <>
                {placement.isFeatured && (
                  <div className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.14em] text-[#9a6a00] uppercase">
                    <span>★</span> Editors&rsquo; Pick
                  </div>
                )}
                {category && (
                  <div className="mb-1.5 text-[10.5px] font-sans font-bold tracking-[0.16em] text-[#0056b3] uppercase">{category}</div>
                )}
                <h2 className="mb-3 text-[32px] leading-[1.08] font-bold tracking-[-0.01em] text-balance">
                  {title || "Untitled Article"}
                </h2>
                <div className="mb-5 flex items-center gap-3 border-y border-[#0f2b5c]/15 py-2 text-[12px] tracking-[0.02em] italic text-[#0f2340]/70">
                  By {author || "Author"}
                </div>
              </>
            ) : (
              <div className="mb-4 text-center text-[11.5px] tracking-[0.04em] text-[#0f2340]/60 italic">
                {title || "Untitled Article"} &nbsp;·&nbsp; continued from page {currentPage - 1}
              </div>
            )
          ) : (
            <div className="mb-4 text-[10px] font-sans font-bold tracking-[0.16em] text-[#0f2340]/40 uppercase">
              In this issue
            </div>
          )}

          {withinArticle ? (
            <>
              <div
                className="relative text-[13.5px] leading-[1.65] [column-gap:26px] [column-rule:1px_solid_rgba(15,43,92,0.14)] [hyphens:auto] [text-align:justify] max-[480px]:columns-1"
                style={{
                  columns: 2,
                  maxHeight: isFirstPageOfArticle ? FIRST_PAGE_COLUMN_HEIGHT : CONTINUATION_COLUMN_HEIGHT,
                  overflow: "hidden",
                }}
              >
                <p
                  className={
                    isFirstPageOfArticle
                      ? "first-letter:float-left first-letter:mr-2 first-letter:mt-0.5 first-letter:font-bold first-letter:text-[52px] first-letter:leading-[38px]"
                      : undefined
                  }
                >
                  {articlePages[currentPage - startPage]}
                </p>
              </div>
              {!isLastPageOfArticle && (
                <p className="mt-1 text-right text-[11px] italic text-[#0f2340]/60">
                  Continued on page {currentPage + 1} →
                </p>
              )}
              {trailingNeighbour && <NeighbourPageBlock piece={trailingNeighbour} compact />}
            </>
          ) : currentNeighbour ? (
            <NeighbourPageBlock piece={currentNeighbour} />
          ) : (
            <p className="text-[13px] text-[#0f2340]/50 italic">Nothing published on this page yet.</p>
          )}
        </div>

        {/* Folio */}
        <div className="relative z-10 flex items-center justify-between border-t border-[#0f2b5c]/70 px-9 py-2.5 font-sans text-[10px] tracking-[0.14em] text-[#0f2340]/60 uppercase max-[480px]:px-6">
          <span>MYHitch Weekly</span>
          <span>Page {currentPage} of {placement.totalArticlesThisIssue}</span>
        </div>
      </div>

      {showMasthead && (
        <p className="mt-4 text-center text-[11px] text-text-muted">
          Pages 1–3 are hand-picked by the MYHitch editorial team each week; every other page follows publish order —
          publish earlier to land on an earlier page.
        </p>
      )}
    </div>
  );
}
