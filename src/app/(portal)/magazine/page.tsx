import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { issueOf, issueOffsetFrom, listIssueArticles } from "@/lib/magazine";
import { MagazineCuration } from "./MagazineCuration";

/** Editor/admin: see how each monthly 128-page issue fills up and pick the lead article for each plan's pages. */
export default async function MagazinePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  if (!["editor", "admin"].includes(session.user.role)) redirect("/explore");

  const { month } = await searchParams;
  const parsed = month ? Number(month) : 0;
  const offset = Number.isFinite(parsed) ? parsed : 0;
  const issue = issueOffsetFrom(new Date(), offset);
  const currentIssue = issueOf(new Date());
  const articles = await listIssueArticles(issue);

  return (
    <MagazineCuration
      issue={issue}
      articles={articles}
      monthOffset={offset}
      isCurrentIssue={issue.issueId === currentIssue.issueId}
    />
  );
}
