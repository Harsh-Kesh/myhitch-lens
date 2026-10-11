import "server-only";

import { prisma } from "@/lib/prisma";
import { blocksOf, coverOf } from "@/lib/hubCompany";

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
  category: { select: { name: true } },
  author: {
    select: {
      displayName: true,
      isVerified: true,
      memberships: { take: 1, select: { org: { select: { id: true, name: true } } } },
    },
  },
} as const;

type Row = Awaited<ReturnType<typeof prisma.article.findMany<{ select: typeof select }>>>[number];

function card(r: Row) {
  const org = r.author.memberships[0]?.org ?? null;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    type: r.contentType,
    category: r.category.name,
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

export async function listPublicArticles(opts: { limit: number; offset: number; orgId?: string }) {
  const rows = await prisma.article.findMany({
    where: {
      ...PUBLIC,
      ...(opts.orgId ? { author: { memberships: { some: { orgId: opts.orgId } } } } : {}),
    },
    orderBy: { publishedAt: "desc" },
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
  return { ...card(row), blocks: row.isPremium ? [] : blocksOf(row.content) };
}
