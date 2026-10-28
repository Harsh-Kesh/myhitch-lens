"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

import { publishArticle, retryReview, unpublishArticle } from "./actions";

/** Latest automated (Copyleaks) review of an article. Scores are 0-100; the combined score is higher-is-better. */
export interface ArticleReviewView {
  state: "pending" | "completed" | "error";
  combinedScore: number | null;
  plagiarismPercent: number | null;
  aiPercent: number | null;
  passMark: number | null;
  error: string | null;
}

export interface SubmittedArticle {
  id: string;
  title: string;
  submittedAt: string;
  /** "approved" and "published" count as approved; "pending" is still with the editors. */
  approval: "approved" | "not_approved" | "pending";
  isPublished: boolean;
  /** Only articles sent back for changes can be reopened in the editor. */
  canEdit: boolean;
  review: ArticleReviewView | null;
}

const APPROVAL_BADGE = {
  approved: { label: "Approved", className: "bg-success/10 text-success" },
  not_approved: { label: "Not approved", className: "bg-danger/10 text-danger" },
  pending: { label: "In review", className: "bg-warning/10 text-warning" },
} as const;

function RowAction({ article }: { article: SubmittedArticle }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ ok: true } | { error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(article.id);
      if ("error" in result) setError(result.error);
    });
  }

  let control: React.ReactNode = <span className="text-[12px] text-text-muted">—</span>;
  if (article.approval === "approved") {
    control = article.isPublished ? (
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(unpublishArticle)}>
        {pending ? "Unpublishing..." : "Unpublish"}
      </Button>
    ) : (
      <Button size="sm" disabled={pending} onClick={() => run(publishArticle)}>
        {pending ? "Publishing..." : "Publish"}
      </Button>
    );
  } else if (article.approval === "pending" && (article.review === null || article.review.state === "error")) {
    control = (
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(retryReview)}>
        {pending ? "Starting..." : "Run check again"}
      </Button>
    );
  } else if (article.approval === "not_approved" && article.canEdit) {
    control = (
      <Link href={`/submit?draft=${article.id}`}>
        <Button size="sm" variant="secondary">Edit</Button>
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {control}
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}

/** What the automated review says about an article, in a line under its approval badge. */
function reviewLine(review: ArticleReviewView | null): string | null {
  if (!review) return null;
  if (review.state === "pending") return "Checking for plagiarism and AI-written text...";
  if (review.state === "error") return review.error ?? "The check couldn't run.";
  const parts = [`Score ${review.combinedScore} / ${review.passMark} needed`];
  if (review.plagiarismPercent !== null) parts.push(`${review.plagiarismPercent}% matched`);
  if (review.aiPercent !== null) parts.push(`${review.aiPercent}% AI`);
  return parts.join(" · ");
}

export function SubmittedArticlesTable({ articles }: { articles: SubmittedArticle[] }) {
  const router = useRouter();
  const checking = articles.some((a) => a.review?.state === "pending");

  // Results arrive by webhook, so keep looking while any check is running.
  useEffect(() => {
    if (!checking) return;
    const timer = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(timer);
  }, [checking, router]);

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-bg-secondary">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] font-semibold tracking-wide text-text-muted uppercase">
            <th className="px-5 py-3">Submitted article</th>
            <th className="px-5 py-3">Approval status</th>
            <th className="px-5 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => {
            const badge = APPROVAL_BADGE[article.approval];
            const line = reviewLine(article.review);
            return (
              <tr key={article.id} className="border-b border-line last:border-b-0">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-text-main">{article.title}</p>
                  <p className="text-[11px] text-text-muted">
                    Submitted {new Date(article.submittedAt).toLocaleDateString()}
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", badge.className)}>
                    {badge.label}
                  </span>
                  {line && <p className="mt-1.5 max-w-[280px] text-[11px] text-text-muted">{line}</p>}
                </td>
                <td className="px-5 py-3.5">
                  <RowAction article={article} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
