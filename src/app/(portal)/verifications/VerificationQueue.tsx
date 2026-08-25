"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { CheckIcon, UsersIcon } from "@/components/ui/icons";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import type { VerificationRequestView } from "@/lib/verification";

import { approveVerification, rejectVerification } from "./actions";

export function VerificationQueue({ queue }: { queue: VerificationRequestView[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function doApprove(userId: string, name: string) {
    if (!confirm(`Approve verification for ${name}? Their Verified blue mark will go live across the platform.`)) return;
    startTransition(async () => {
      const res = await approveVerification(userId);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function doReject(userId: string, name: string) {
    const note = window.prompt(`Decline ${name}'s application. Reason (shown to the author so they can re-apply):`, "");
    if (note === null) return;
    if (!note.trim()) {
      alert("A reason is required.");
      return;
    }
    startTransition(async () => {
      const res = await rejectVerification(userId, note);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      <ViewHeader
        title="Author Verification"
        subtitle="Review applications for the Verified blue mark. Approving confirms a real, credible voice; the badge then shows wherever the author appears."
      />

      <div className={dashCard}>
        <h3 className={dashHeading}>
          <UsersIcon className="size-[18px] text-primary" /> Pending Applications ({queue.length})
        </h3>

        {queue.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-text-muted">No applications awaiting review.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {queue.map((r) => (
              <div key={r.userId} className="rounded-lg border border-line bg-bg-primary p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-[15px] font-bold text-text-main">{r.name}</span>
                      <span className="rounded bg-bg-tertiary px-2 py-0.5 text-[10px] font-semibold text-text-muted uppercase">
                        {r.role}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-text-muted">
                      {r.articlesPublished} article(s) · applied {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
                      r.domainMatch ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
                    )}
                  >
                    {r.domainMatch ? (
                      <>
                        <CheckIcon className="size-3" strokeWidth={3} /> Domain verified
                      </>
                    ) : (
                      "Domain unconfirmed"
                    )}
                  </span>
                </div>

                <div className="mb-4 grid gap-2 text-[12.5px]">
                  <div>
                    <span className="font-semibold text-text-main">Organisation:</span>{" "}
                    <span className="text-text-muted">{r.organisation || "—"}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-text-main">Links:</span>{" "}
                    {r.links.length === 0 ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-x-3">
                        {r.links.map((l) => (
                          <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            {l}
                          </a>
                        ))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button size="sm" disabled={isPending} onClick={() => doApprove(r.userId, r.name)}>
                    <span className="inline-flex items-center gap-1">
                      <VerifiedBadge size="xs" /> Approve
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    className="border-[rgba(239,68,68,0.2)] text-danger"
                    onClick={() => doReject(r.userId, r.name)}
                  >
                    Decline
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
