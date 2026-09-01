import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * The MYHitch magazine (published outside Lens) is weekly. The first 3 pages
 * of each issue are hand-picked by the MYHitch team; every other article that
 * published that week fills the remaining pages in publish order — publish
 * earlier in the week (or in an earlier week) and you land on an earlier page.
 * This lets authors write ahead and see roughly where they'll land.
 */

export interface MagazineIssue {
  weekId: string; // e.g. "2026-W35"
  weekLabel: string; // "Aug 24 – Aug 30, 2026"
  weekStart: Date;
  weekEnd: Date;
}

/** Monday-start ISO week containing `date`. */
export function isoWeekOf(date: Date): MagazineIssue {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1 .. Sun=7
  d.setUTCDate(d.getUTCDate() - day + 1);
  const weekStart = new Date(d);
  const weekEnd = new Date(d);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const target = new Date(d.valueOf());
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNo =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    );

  const fmt = (dt: Date) => dt.toLocaleDateString("en-AU", { month: "short", day: "numeric", timeZone: "UTC" });
  const weekLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}, ${weekEnd.getUTCFullYear()}`;

  return {
    weekId: `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`,
    weekLabel,
    weekStart,
    weekEnd,
  };
}

/** Shift a reference date forward/back by N weeks and return that week's issue. */
export function issueOffsetFrom(date: Date, weekOffset: number): MagazineIssue {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + weekOffset * 7);
  return isoWeekOf(shifted);
}

interface PlacementRow {
  id: string;
  title: string;
  author: string;
  magazineFeatured: boolean;
  magazineFeatureOrder: number | null;
  publishedAt: Date;
}

/** Curated slots first (by their assigned order), then everyone else by publish time. */
function orderPlacements(rows: PlacementRow[]): PlacementRow[] {
  const featured = rows
    .filter((r) => r.magazineFeatured)
    .sort((a, b) => (a.magazineFeatureOrder ?? 99) - (b.magazineFeatureOrder ?? 99));
  const rest = rows
    .filter((r) => !r.magazineFeatured)
    .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  return [...featured, ...rest];
}

async function articlesInIssue(issue: MagazineIssue): Promise<PlacementRow[]> {
  const rows = await prisma.article.findMany({
    where: { status: "published", publishedAt: { gte: issue.weekStart, lte: issue.weekEnd } },
    select: {
      id: true,
      title: true,
      magazineFeatured: true,
      magazineFeatureOrder: true,
      publishedAt: true,
      author: { select: { displayName: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    author: r.author.displayName,
    magazineFeatured: r.magazineFeatured,
    magazineFeatureOrder: r.magazineFeatureOrder,
    publishedAt: r.publishedAt as Date,
  }));
}

export interface MagazinePlacement {
  issue: MagazineIssue;
  page: number;
  isFeatured: boolean;
  totalArticlesThisIssue: number;
  /** True when the article isn't published yet — this is a live projection, not a locked-in page. */
  isEstimate: boolean;
}

/** Compute (or, for an unpublished article, project) its weekly-issue page placement. */
export async function getMagazinePlacement(articleId: string): Promise<MagazinePlacement | null> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      status: true,
      publishedAt: true,
      magazineFeatured: true,
      magazineFeatureOrder: true,
      title: true,
      author: { select: { displayName: true } },
    },
  });
  if (!article) return null;

  const isPublished = article.status === "published" && Boolean(article.publishedAt);
  const effectiveDate = article.publishedAt ?? new Date();
  const issue = isoWeekOf(effectiveDate);
  const rows = await articlesInIssue(issue);

  let ordered: PlacementRow[];
  if (isPublished) {
    ordered = orderPlacements(rows);
  } else {
    // Project: insert this article as if it published right now, without persisting anything.
    ordered = orderPlacements([
      ...rows,
      {
        id: articleId,
        title: article.title,
        author: article.author.displayName,
        magazineFeatured: article.magazineFeatured,
        magazineFeatureOrder: article.magazineFeatureOrder,
        publishedAt: effectiveDate,
      },
    ]);
  }

  const idx = ordered.findIndex((r) => r.id === articleId);
  return {
    issue,
    page: idx === -1 ? ordered.length + 1 : idx + 1,
    isFeatured: article.magazineFeatured,
    totalArticlesThisIssue: ordered.length,
    isEstimate: !isPublished,
  };
}

export interface IssueArticleRow {
  id: string;
  title: string;
  author: string;
  page: number;
  isFeatured: boolean;
  featureOrder: number | null;
  publishedAt: string;
}

/** Full page-by-page listing for a given issue — for the editor curation screen. */
export async function listIssueArticles(issue: MagazineIssue): Promise<IssueArticleRow[]> {
  const rows = await articlesInIssue(issue);
  const ordered = orderPlacements(rows);
  return ordered.map((r, i) => ({
    id: r.id,
    title: r.title,
    author: r.author,
    page: i + 1,
    isFeatured: r.magazineFeatured,
    featureOrder: r.magazineFeatureOrder,
    publishedAt: r.publishedAt.toISOString(),
  }));
}
