"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { ShieldIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";

import { dismissReport, removeArticle, resolveAppeal, suspendAuthor, unsuspendAuthor } from "./actions";

interface Report {
  id: string;
  articleId: string;
  articleTitle: string;
  reporter: string;
  details: string;
  createdAt: string;
  authorId: string | null;
  authorName: string;
  authorStrikes: number;
  authorSuspended: boolean;
}

interface Appeal {
  id: string;
  articleId: string;
  articleTitle: string;
  appealText: string;
  appealedAt: string;
  authorId: string | null;
  authorName: string;
  authorStrikes: number;
  authorSuspended: boolean;
}

function StrikeBadge({ strikes }: { strikes: number }) {
  if (strikes <= 0) return null;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", strikes >= 3 ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")}>
      {strikes} strike{strikes === 1 ? "" : "s"}
    </span>
  );
}

export function ModerationQueue({ reports, appeals }: { reports: Report[]; appeals: Appeal[] }) {
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

  function doResolveAppeal(id: string, decision: "uphold" | "reinstate") {
    const msg = decision === "reinstate" ? "Reinstate this article and reverse the strike?" : "Deny this appeal? The removal will stand.";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await resolveAppeal(id, decision);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function doSuspend(userId: string, name: string) {
    const reason = prompt(`Suspend ${name}? Enter a reason:`);
    if (!reason || !reason.trim()) return;
    startTransition(async () => {
      const res = await suspendAuthor(userId, reason.trim());
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function doUnsuspend(userId: string) {
    startTransition(async () => {
      const res = await unsuspendAuthor(userId);
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

      {appeals.length > 0 && (
        <div className={cn(dashCard, "mb-6")}>
          <h3 className={dashHeading}>
            <ShieldIcon className="size-[18px] text-warning" /> Pending Appeals ({appeals.length})
          </h3>
          <div className="flex flex-col gap-4">
            {appeals.map((a) => (
              <div key={a.id} className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <Link href={`/article?id=${a.articleId}`} className="font-heading text-[14.5px] font-bold text-text-main hover:text-primary">
                    {a.articleTitle}
                  </Link>
                  <span className="text-[11px] text-text-muted">{new Date(a.appealedAt).toLocaleDateString()}</span>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
                  <span>Author: <span className="font-semibold text-text-main">{a.authorName}</span></span>
                  <StrikeBadge strikes={a.authorStrikes} />
                  {a.authorSuspended && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10.5px] font-bold text-danger">Suspended</span>}
                </div>
                <p className="mb-3 rounded bg-bg-tertiary px-3 py-2 text-[12.5px] text-text-muted">{a.appealText}</p>
                <div className="flex flex-wrap gap-3">
                  <Button size="sm" disabled={isPending} onClick={() => doResolveAppeal(a.id, "reinstate")}>
                    Reinstate article
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    className="border-[rgba(239,68,68,0.2)] text-danger"
                    onClick={() => doResolveAppeal(a.id, "uphold")}
                  >
                    Deny appeal
                  </Button>
                  {a.authorId && !a.authorSuspended && (
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => doSuspend(a.authorId!, a.authorName)}>
                      Suspend author
                    </Button>
                  )}
                  {a.authorId && a.authorSuspended && (
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => doUnsuspend(a.authorId!)}>
                      Unsuspend author
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
                  <span>Author: <span className="font-semibold text-text-main">{r.authorName}</span></span>
                  <StrikeBadge strikes={r.authorStrikes} />
                  {r.authorSuspended && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10.5px] font-bold text-danger">Suspended</span>}
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
                  {r.authorId && !r.authorSuspended && (
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => doSuspend(r.authorId!, r.authorName)}>
                      Suspend author
                    </Button>
                  )}
                  {r.authorId && r.authorSuspended && (
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => doUnsuspend(r.authorId!)}>
                      Unsuspend author
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
