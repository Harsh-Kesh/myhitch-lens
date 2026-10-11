import "server-only";

import { getPlanCode } from "@/lib/entitlements";
import { MAGAZINE_SECTIONS, sectionOfPage, type PageRange } from "@/lib/magazineLayout";
import { PLANS, type PlanCode } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

/**
 * There is ONE MYHitch Lens magazine a month: 128 pages, with a block of pages
 * for each kind of contributor (see magazineLayout.ts). An article published in
 * a month lands in that month's issue, on pages its author's plan allows. Each
 * article is allotted the plan's pages-per-article (Free: 2), so the Free block
 * (121-124) holds two articles; once a block is full, later articles wait.
 *
 * Placement is computed from what is published, not stored: an author sees where
 * they would land, and the page can shift until the issue is final. Plans are
 * read as they stand now, not as they were at publish time.
 */

export interface MagazineIssue {
  issueId: string; // e.g. "2026-08"
  label: string; // "August 2026"
  start: Date;
  end: Date;
}

/** The calendar-month issue (UTC) containing `date`. */
export function issueOf(date: Date): MagazineIssue {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - 1);
  return {
    issueId: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
    label: start.toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }),
    start,
    end,
  };
}

/** Shift a reference date forward/back by N months and return that month's issue. */
export function issueOffsetFrom(date: Date, monthOffset: number): MagazineIssue {
  return issueOf(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1)));
}

interface PlacementRow {
  id: string;
  title: string;
  summary: string;
  author: string;
  plan: PlanCode;
  magazineFeatured: boolean;
  magazineFeatureOrder: number | null;
  publishedAt: Date;
}

export interface PagePlacement {
  pageStart: number;
  pageEnd: number;
}

/** Editor picks lead (by their slot), then everyone else by publish time. */
function byPriority(a: PlacementRow, b: PlacementRow): number {
  if (a.magazineFeatured !== b.magazineFeatured) return a.magazineFeatured ? -1 : 1;
  if (a.magazineFeatured) return (a.magazineFeatureOrder ?? 99) - (b.magazineFeatureOrder ?? 99);
  return a.publishedAt.getTime() - b.publishedAt.getTime();
}

/** Sections an author's plan may use, in the order they fill: premium, then middle, then the free block. */
const FILL_ORDER: PageRange[] = [MAGAZINE_SECTIONS.premium, MAGAZINE_SECTIONS.middle, MAGAZINE_SECTIONS.contributors];

/** The first run of `size` free pages inside `range`, taking sections in fill order. */
function findBlock(used: Set<number>, range: PageRange, size: number): PagePlacement | null {
  for (const section of FILL_ORDER) {
    const from = Math.max(section.from, range.from);
    const to = Math.min(section.to, range.to);
    for (let start = from; start + size - 1 <= to; start++) {
      let free = true;
      for (let p = start; p < start + size; p++) {
        if (used.has(p)) {
          free = false;
          break;
        }
      }
      if (free) return { pageStart: start, pageEnd: start + size - 1 };
    }
  }
  return null;
}

/**
 * Gives every article its pages. Free fills its own block first, so a Professional
 * overflow can never take the pages Free is promised; Creator goes last in the
 * middle section, after the plans that may also overflow into it.
 * `null` = that plan's pages are full for this issue.
 */
function allocate(rows: PlacementRow[]): Map<string, PagePlacement | null> {
  const used = new Set<number>();
  const result = new Map<string, PagePlacement | null>();
  const passes: PlanCode[][] = [["free"], ["professional", "business"], ["creator"]];

  for (const plans of passes) {
    const group = rows.filter((r) => plans.includes(r.plan)).sort(byPriority);
    for (const row of group) {
      const { magazineRange, maxPagesPerArticle } = PLANS[row.plan].entitlements;
      const block = findBlock(used, magazineRange, maxPagesPerArticle);
      if (block) for (let p = block.pageStart; p <= block.pageEnd; p++) used.add(p);
      result.set(row.id, block);
    }
  }
  return result;
}

async function articlesInIssue(issue: MagazineIssue): Promise<PlacementRow[]> {
  const rows = await prisma.article.findMany({
    where: { status: "published", publishedAt: { gte: issue.start, lte: issue.end } },
    select: {
      id: true,
      title: true,
      summary: true,
      authorId: true,
      magazineFeatured: true,
      magazineFeatureOrder: true,
      publishedAt: true,
      author: { select: { displayName: true } },
    },
  });
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const plans = new Map(await Promise.all(authorIds.map(async (id) => [id, await getPlanCode(id)] as const)));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    author: r.author.displayName,
    plan: plans.get(r.authorId) ?? "free",
    magazineFeatured: r.magazineFeatured,
    magazineFeatureOrder: r.magazineFeatureOrder,
    publishedAt: r.publishedAt as Date,
  }));
}

export interface MagazinePlacement {
  issue: MagazineIssue;
  /** First page of the article's allotment; null when its plan's pages are full this issue. */
  page: number | null;
  /** Last page of the allotment. */
  pageEnd: number | null;
  /** Pages this article's plan lets it take up. */
  pagesAllotted: number;
  /** The pages this plan can be placed on. */
  planRange: PageRange;
  sectionLabel: string | null;
  isFeatured: boolean;
  totalArticlesThisIssue: number;
  /** True when the article isn't published yet — this is a live projection, not a locked-in page. */
  isEstimate: boolean;
}

/** Compute (or, for an unpublished article, project) its monthly-issue page placement. */
export async function getMagazinePlacement(articleId: string): Promise<MagazinePlacement | null> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      status: true,
      publishedAt: true,
      authorId: true,
      magazineFeatured: true,
      magazineFeatureOrder: true,
      title: true,
      summary: true,
      author: { select: { displayName: true } },
    },
  });
  if (!article) return null;

  const isPublished = article.status === "published" && Boolean(article.publishedAt);
  const effectiveDate = article.publishedAt ?? new Date();
  const issue = issueOf(effectiveDate);
  const rows = await articlesInIssue(issue);
  const plan = await getPlanCode(article.authorId);

  // An unpublished article is projected in as if it published right now, without persisting anything.
  const all = isPublished
    ? rows
    : [
        ...rows,
        {
          id: articleId,
          title: article.title,
          summary: article.summary,
          author: article.author.displayName,
          plan,
          magazineFeatured: article.magazineFeatured,
          magazineFeatureOrder: article.magazineFeatureOrder,
          publishedAt: effectiveDate,
        },
      ];

  const block = allocate(all).get(articleId) ?? null;
  const { magazineRange, maxPagesPerArticle } = PLANS[plan].entitlements;
  return {
    issue,
    page: block?.pageStart ?? null,
    pageEnd: block?.pageEnd ?? null,
    pagesAllotted: maxPagesPerArticle,
    planRange: magazineRange,
    sectionLabel: block ? (sectionOfPage(block.pageStart)?.label ?? null) : null,
    isFeatured: article.magazineFeatured,
    totalArticlesThisIssue: all.length,
    isEstimate: !isPublished,
  };
}

export interface IssueArticleRow {
  id: string;
  title: string;
  summary: string;
  author: string;
  plan: PlanCode;
  /** null = waiting: this plan's pages are full in this issue. */
  pageStart: number | null;
  pageEnd: number | null;
  isFeatured: boolean;
  featureOrder: number | null;
  publishedAt: string;
}

/** Page-by-page listing for a given issue — for the editor curation screen and neighbouring-page previews. */
export async function listIssueArticles(issue: MagazineIssue): Promise<IssueArticleRow[]> {
  const rows = await articlesInIssue(issue);
  const placed = allocate(rows);
  return rows
    .map((r) => {
      const block = placed.get(r.id) ?? null;
      return {
        id: r.id,
        title: r.title,
        summary: r.summary,
        author: r.author,
        plan: r.plan,
        pageStart: block?.pageStart ?? null,
        pageEnd: block?.pageEnd ?? null,
        isFeatured: r.magazineFeatured,
        featureOrder: r.magazineFeatureOrder,
        publishedAt: r.publishedAt.toISOString(),
      };
    })
    .sort((a, b) => (a.pageStart ?? Infinity) - (b.pageStart ?? Infinity));
}

export interface NextIssueSummary {
  currentIssueLabel: string;
  nextIssueReleaseDate: string; // ISO
  planName: string;
  /** The pages this author's plan can be placed on, and how many one article takes. */
  planRange: PageRange;
  pagesPerArticle: number;
  /** Pages an article would get if published right now; null when the plan's pages are full this issue. */
  availablePage: { pageStart: number; pageEnd: number } | null;
}

/** For the author dashboard: when the next monthly issue drops, and what pages this author could get right now. */
export async function getNextIssueSummary(userId: string): Promise<NextIssueSummary> {
  const now = new Date();
  const currentIssue = issueOf(now);
  const nextIssue = issueOffsetFrom(now, 1);
  const [rows, plan] = await Promise.all([articlesInIssue(currentIssue), getPlanCode(userId)]);

  const projectedId = "__next-article__";
  const projection: PlacementRow = {
    id: projectedId,
    title: "",
    summary: "",
    author: "",
    plan,
    magazineFeatured: false,
    magazineFeatureOrder: null,
    publishedAt: now,
  };
  const { magazineRange, maxPagesPerArticle } = PLANS[plan].entitlements;

  return {
    currentIssueLabel: currentIssue.label,
    nextIssueReleaseDate: nextIssue.start.toISOString(),
    planName: PLANS[plan].name,
    planRange: magazineRange,
    pagesPerArticle: maxPagesPerArticle,
    availablePage: allocate([...rows, projection]).get(projectedId) ?? null,
  };
}
