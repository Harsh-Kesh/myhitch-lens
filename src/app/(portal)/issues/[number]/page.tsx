import { notFound } from "next/navigation";

import { getIssue } from "@/lib/magazineIssues";
import { IssueReader } from "./IssueReader";

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props) {
  const issue = await getIssue(Number((await params).number));
  return { title: issue ? `${issue.title} | MYHitch Lens` : "Issue | MYHitch Lens" };
}

/** One released issue as a flipbook. */
export default async function IssuePage({ params, searchParams }: Props) {
  const [{ number }, { page }] = await Promise.all([params, searchParams]);
  const issue = await getIssue(Number(number));
  if (!issue) notFound();
  return <IssueReader issue={issue} startPage={Math.max(1, Number(page) || 1)} />;
}
