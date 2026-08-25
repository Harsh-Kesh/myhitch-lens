"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { ShieldIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";

import { dismissReport, removeArticle } from "./actions";

interface Report {
  id: string;
  articleId: string;
  articleTitle: string;
  reporter: string;
  details: string;
  createdAt: string;
}

export function ModerationQueue({ reports }: { reports: Report[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function doRemove(id: string, title: string) {
    if (!confirm(`Remove "${title}"? It will be unpublished immediately and the author notified.`)) return;
    startTransition(async () => {
      const res = await removeArticle(id);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function doDismiss(id: string) {
    startTransition(async () => {
      const res = await dismissReport(id);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      <ViewHeader
        title="Copyright Moderation"
        subtitle="Review copyright / infringement reports and take down offending articles (notice-and-takedown)."
      />

      <div className={dashCard}>
        <h3 className={dashHeading}>
          <ShieldIcon className="size-[18px] text-primary" /> Open Reports ({reports.length})
        </h3>

        {reports.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-text-muted">No open copyright reports.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {reports.map((r) => (
              <div key={r.id} className="rounded-lg border border-line bg-bg-primary p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <Link href={`/article?id=${r.articleId}`} className="font-heading text-[14.5px] font-bold text-text-main hover:text-primary">
                    {r.articleTitle}
                  </Link>
                  <span className="text-[11px] text-text-muted">
                    reported by {r.reporter} · {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mb-3 rounded bg-bg-tertiary px-3 py-2 text-[12.5px] text-text-muted">
                  {r.details}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    className="border-[rgba(239,68,68,0.2)] text-danger"
                    onClick={() => doRemove(r.id, r.articleTitle)}
                  >
                    Remove article
                  </Button>
                  <Button size="sm" variant="secondary" disabled={isPending} onClick={() => doDismiss(r.id)}>
                    Dismiss report
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
