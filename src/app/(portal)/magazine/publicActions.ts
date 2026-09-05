"use server";

import { getMagazinePlacement as getPlacement, listIssueArticles, type IssueArticleRow, type MagazinePlacement } from "@/lib/magazine";

/** Client-callable wrapper — src/lib/magazine.ts is server-only, not a server action. */
export async function getMagazinePlacement(articleId: string) {
  return getPlacement(articleId);
}

export interface MagazineView {
  placement: MagazinePlacement;
  issueArticles: IssueArticleRow[];
}

/** Placement plus every real article in that issue, so neighbouring pages can show real content. */
export async function getMagazineView(articleId: string): Promise<MagazineView | null> {
  const placement = await getPlacement(articleId);
  if (!placement) return null;
  const issueArticles = await listIssueArticles(placement.issue);
  return { placement, issueArticles };
}
