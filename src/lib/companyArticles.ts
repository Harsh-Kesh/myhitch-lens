import "server-only";

import type { OrgRole, Prisma } from "@prisma/client";

import { getSubmissionAllowance, upgradeMessage } from "@/lib/entitlements";

/**
 * The company article rules, shared by the website's company dashboard
 * (src/app/(portal)/company/actions.ts) and the MYHitch app (through the hub,
 * src/lib/hubCompany.ts), so both answer the same.
 */

/**
 * A company's articles. New ones carry the company (Article.orgId). Older ones
 * don't: they are the articles of the company's corporate members. A member
 * who is an individual author (an author who also owns a company, opened from
 * the MYHitch app) keeps their own articles out of the company's.
 */
export function companyArticleWhere(orgId: string): Prisma.ArticleWhereInput {
  return {
    OR: [{ orgId }, { orgId: null, author: { role: "corporate", memberships: { some: { orgId } } } }],
  };
}

/**
 * Articles for the platform's own editorial queue: not company articles, which
 * the company's own reviewers handle.
 */
export const notCompanyArticle: Prisma.ArticleWhereInput = { orgId: null, author: { role: { not: "corporate" } } };

export type CompanyAbility = "team" | "write" | "review";

/**
 * What a company member may do. Authors write, editors review, and the owner
 * does both (and runs the team). Nobody reviews their own article - see
 * ownArticleError - so an owner's article needs an editor (or another owner)
 * to publish it.
 */
export function companyCan(membership: { isAdmin: boolean; orgRole: OrgRole }, ability: CompanyAbility): boolean {
  if (membership.isAdmin) return true;
  if (ability === "write") return membership.orgRole === "author";
  if (ability === "review") return membership.orgRole === "editor";
  return false;
}

/** Why [reviewerId] can't approve or reject this article, or null if they can. */
export function ownArticleError(article: { authorId: string }, reviewerId: string): string | null {
  return article.authorId === reviewerId
    ? "You can't review your own article. Someone else in your company (an editor) has to approve it."
    : null;
}

/**
 * The plan's monthly submission allowance, as the website's submit page applies
 * it: a new company article counts like any other first submission.
 */
export async function submissionAllowanceError(userId: string): Promise<string | null> {
  const allowance = await getSubmissionAllowance(userId);
  if (allowance.allowed) return null;
  return upgradeMessage(`You've used all ${allowance.limit} article submissions your plan includes this month.`);
}
