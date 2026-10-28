import Link from "next/link";

import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/DashboardKit";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { prisma } from "@/lib/prisma";

import { SubmittedArticlesTable, type SubmittedArticle } from "./SubmittedArticlesTable";

export default async function SubmitArticlePage() {
  const session = await auth();

  // Everything the author has sent in: drafts that were never submitted aren't listed.
  const rows = await prisma.article.findMany({
    where: {
      authorId: session!.user.id,
      status: { in: ["in_review", "changes_requested", "approved", "scheduled", "published", "rejected"] },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      articleReviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { state: true, combinedScore: true, plagiarismPercent: true, aiPercent: true, passMark: true, error: true },
      },
    },
  });

  const articles: SubmittedArticle[] = rows.map((r) => ({
    id: r.id,
    title: r.title || "Untitled",
    submittedAt: r.updatedAt.toISOString(),
    approval:
      r.status === "in_review"
        ? "pending"
        : r.status === "changes_requested" || r.status === "rejected"
          ? "not_approved"
          : "approved",
    isPublished: r.status === "published",
    canEdit: r.status === "changes_requested",
    review: r.articleReviews[0] ?? null,
  }));

  return (
    <>
      <ViewHeader title="Submit Article" subtitle="Track your submissions, then publish what's been approved." />
      {articles.length === 0 ? (
        <EmptyState
          text="You haven't submitted any articles yet."
          cta={<Link href="/submit" className="text-[13px] font-semibold text-primary hover:underline">Write an article</Link>}
        />
      ) : (
        <SubmittedArticlesTable articles={articles} />
      )}
    </>
  );
}
