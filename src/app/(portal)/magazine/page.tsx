import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isoWeekOf, issueOffsetFrom, listIssueArticles } from "@/lib/magazine";
import { MagazineCuration } from "./MagazineCuration";

/** Editor/admin: curate the first 3 pages of each weekly magazine issue. */
export default async function MagazinePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  if (!["editor", "admin"].includes(session.user.role)) redirect("/explore");

  const { week } = await searchParams;
  const offset = week ? Number(week) : 0;
  const issue = issueOffsetFrom(new Date(), Number.isFinite(offset) ? offset : 0);
  const currentIssue = isoWeekOf(new Date());
  const articles = await listIssueArticles(issue);

  return (
    <MagazineCuration
      issue={issue}
      articles={articles}
      weekOffset={Number.isFinite(offset) ? offset : 0}
      isCurrentWeek={issue.weekId === currentIssue.weekId}
    />
  );
}
