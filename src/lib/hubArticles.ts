import "server-only";

import type { Prisma } from "@prisma/client";

import { companyArticleWhere } from "@/lib/companyArticles";
import { prisma } from "@/lib/prisma";
import { coverOf, readingOf } from "@/lib/articleBlocks";

/** Published, public articles for the MYHitch app (through the hub). */

const PUBLIC = { status: "published" as const, lane: { in: ["public" as const, "hybrid" as const] } };

function readTimeOf(aiScores: unknown): number {
  const min =
    aiScores && typeof aiScores === "object" && "readTimeMin" in aiScores
      ? Number((aiScores as { readTimeMin: unknown }).readTimeMin)
      : NaN;
  return Number.isFinite(min) && min > 0 ? Math.round(min) : 5;
}

const select = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  content: true,
  contentType: true,
  verified: true,
  isPremium: true,
  likesCount: true,
  viewsCount: true,
  aiScores: true,
  publishedAt: true,
  category: { select: { name: true, slug: true } },
  org: { select: { id: true, name: true } },
  author: {
    select: {
      displayName: true,
      isVerified: true,
      role: true,
      memberships: { take: 1, select: { org: { select: { id: true, name: true } } } },
    },
  },
} as const;

type Row = Awaited<ReturnType<typeof prisma.article.findMany<{ select: typeof select }>>>[number];

function card(r: Row) {
  // The company it was written for; older company articles: their corporate author's company.
  // An individual author's own articles show under their name, even if they also own a company.
  const org = r.org ?? (r.author.role === "corporate" ? r.author.memberships[0]?.org ?? null : null);
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    type: r.contentType,
    category: r.category.name,
    categorySlug: r.category.slug,
    author: r.author.displayName,
    authorVerified: r.author.isVerified,
    organization: org,
    verified: r.verified,
    premium: r.isPremium,
    likes: r.likesCount,
    views: r.viewsCount,
    readTimeMin: readTimeOf(r.aiScores),
    cover: r.isPremium ? null : coverOf(r.content),
    publishedAt: r.publishedAt?.toISOString() ?? null,
  };
}

export async function listPublicArticles(opts: {
  limit: number;
  offset: number;
  orgId?: string;
  /** Words to find in the title, summary or author's name. */
  q?: string;
  /** A category's slug. */
  category?: string;
}) {
  const and: Prisma.ArticleWhereInput[] = [];
  if (opts.orgId) and.push(companyArticleWhere(opts.orgId));
  if (opts.category) and.push({ category: { slug: opts.category } });
  if (opts.q) {
    // Every word has to match somewhere, as the website's Explore search narrows as you type.
    for (const word of opts.q.split(/s+/).filter(Boolean).slice(0, 8)) {
      and.push({
        OR: [
          { title: { contains: word, mode: "insensitive" } },
          { summary: { contains: word, mode: "insensitive" } },
          { author: { displayName: { contains: word, mode: "insensitive" } } },
        ],
      });
    }
  }
  const rows = await prisma.article.findMany({
    where: { ...PUBLIC, ...(and.length ? { AND: and } : {}) },
    // Ties broken by id so pages never repeat or skip an article.
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: opts.offset,
    take: opts.limit + 1,
    select,
  });
  return { articles: rows.slice(0, opts.limit).map(card), more: rows.length > opts.limit };
}

/** One article, to read in the app. Premium ones only have their summary. */
export async function publicArticle(id: string) {
  const row = await prisma.article.findFirst({ where: { ...PUBLIC, OR: [{ id }, { slug: id }] }, select });
  if (!row) return null;
  if (row.isPremium) return { ...card(row), blocks: [], flattened: false };
  const reading = readingOf(row.content);
  // flattened: the app shows a simpler version (or leaves out clips), so it offers the article on Lens.
  return { ...card(row), blocks: reading.blocks, flattened: reading.flattened };
}
