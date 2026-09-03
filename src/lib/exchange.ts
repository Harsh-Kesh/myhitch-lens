import "server-only";

import { prisma } from "@/lib/prisma";
import type { ExchangeOpportunityStatus, ExchangeOpportunityType } from "@prisma/client";

/** Article statuses an author can route into the Exchange Hub instead of publishing directly. */
export const EXCHANGE_ELIGIBLE_STATUSES = ["draft", "in_review", "changes_requested", "approved"] as const;

/** Opportunity statuses that are still "in play" — not yet a final outcome. */
export const EXCHANGE_OPEN_STATUSES: ExchangeOpportunityStatus[] = ["open", "in_negotiation", "agreement_pending"];

export interface ExchangeListableArticle {
  id: string;
  title: string;
  category: string;
}

/**
 * Article ids with an unresolved copyright complaint against them right now.
 * `DisputeTicket.subject` encodes the article as `"<id> — <title>"` — there's
 * no direct FK, so this parses it rather than joining.
 */
async function articleIdsWithOpenCopyrightDispute(): Promise<Set<string>> {
  const tickets = await prisma.disputeTicket.findMany({
    where: { reason: "copyright", status: { in: ["open", "under_review"] } },
    select: { subject: true },
  });
  return new Set(tickets.map((t) => t.subject.split(" — ")[0]));
}

/** True if the article has confirmed original rights and no active copyright complaint. */
export async function isCopyrightClear(articleId: string): Promise<boolean> {
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { rightsAttested: true } });
  if (!article?.rightsAttested) return false;
  const disputed = await articleIdsWithOpenCopyrightDispute();
  return !disputed.has(articleId);
}

/** The author's own articles eligible to submit as a new opportunity right now — copyright-clear only. */
export async function listExchangeEligibleArticles(authorId: string): Promise<ExchangeListableArticle[]> {
  const [articles, disputedIds] = await Promise.all([
    prisma.article.findMany({
      where: {
        authorId,
        status: { in: [...EXCHANGE_ELIGIBLE_STATUSES] },
        rightsAttested: true,
        exchangeOpportunities: { none: { status: { in: EXCHANGE_OPEN_STATUSES } } },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, category: { select: { name: true } } },
    }),
    articleIdsWithOpenCopyrightDispute(),
  ]);
  return articles
    .filter((a) => !disputedIds.has(a.id))
    .map((a) => ({ id: a.id, title: a.title, category: a.category.name }));
}

export interface AuthorOpportunity {
  id: string;
  articleId: string;
  articleTitle: string;
  type: ExchangeOpportunityType;
  description: string;
  status: ExchangeOpportunityStatus;
  expectedValue: number | null;
  closingAt: string | null;
  agreedBrandName: string | null;
  agreedValue: number | null;
  agreedTerms: string | null;
  createdAt: string;
}

/** An author's own opportunity submissions, newest first. */
export async function listAuthorOpportunities(authorId: string): Promise<AuthorOpportunity[]> {
  const rows = await prisma.exchangeOpportunity.findMany({
    where: { authorId },
    orderBy: { createdAt: "desc" },
    include: { article: { select: { title: true } } },
  });
  return rows.map((o) => ({
    id: o.id,
    articleId: o.articleId,
    articleTitle: o.article.title,
    type: o.type,
    description: o.description,
    status: o.status,
    expectedValue: o.expectedValue != null ? Number(o.expectedValue) : null,
    closingAt: o.closingAt?.toISOString() ?? null,
    agreedBrandName: o.agreedBrandName,
    agreedValue: o.agreedValue != null ? Number(o.agreedValue) : null,
    agreedTerms: o.agreedTerms,
    createdAt: o.createdAt.toISOString(),
  }));
}

export interface EditorOpportunity extends AuthorOpportunity {
  authorName: string;
}

/** Opportunities awaiting editor/admin action — stands in for the Exchange Hub's own queue until Connect exists. */
export async function listOpenOpportunitiesForEditors(): Promise<EditorOpportunity[]> {
  const rows = await prisma.exchangeOpportunity.findMany({
    where: { status: { in: EXCHANGE_OPEN_STATUSES } },
    orderBy: { createdAt: "asc" },
    include: {
      article: { select: { title: true } },
      author: { select: { displayName: true } },
    },
  });
  return rows.map((o) => ({
    id: o.id,
    articleId: o.articleId,
    articleTitle: o.article.title,
    authorName: o.author.displayName,
    type: o.type,
    description: o.description,
    status: o.status,
    expectedValue: o.expectedValue != null ? Number(o.expectedValue) : null,
    closingAt: o.closingAt?.toISOString() ?? null,
    agreedBrandName: o.agreedBrandName,
    agreedValue: o.agreedValue != null ? Number(o.agreedValue) : null,
    agreedTerms: o.agreedTerms,
    createdAt: o.createdAt.toISOString(),
  }));
}
