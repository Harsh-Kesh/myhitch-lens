"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { cn } from "@/lib/cn";
import { requestVerification } from "../verifications/actions";

type State = "none" | "pending" | "approved" | "rejected";

export function VerificationStatus({
  state,
  reviewerNote,
}: {
  state: State;
  reviewerNote: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (state === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-glow px-2 py-0.5 text-[11px] font-semibold text-primary">
        <VerifiedBadge size="xs" /> Verified
      </span>
    );
  }

  if (state === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
        Verification pending
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary-glow"
      >
        {state === "rejected" ? "Re-apply for verification" : "Get verified"}
      </button>
      {state === "rejected" && reviewerNote && (
        <span className="ml-2 text-[11px] text-danger">Declined: {reviewerNote}</span>
      )}
      {open && <VerificationModal onClose={() => setOpen(false)} />}
    </>
  );
}

function VerificationModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [organisation, setOrganisation] = useState("");
  const [links, setLinks] = useState("");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 z-50 w-[min(460px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-bg-secondary p-6 shadow-card">
        <h3 className="mb-1 flex items-center gap-2 font-heading text-lg font-bold text-text-main">
          <VerifiedBadge size="md" /> Apply for the Verified badge
        </h3>
        <p className="mb-4 text-[12.5px] text-text-muted">
          Verification confirms you are a real, credible voice. An editor reviews your details; if
          your email domain matches your organisation it strengthens your application.
        </p>

        <div className="mb-4">
          <label className={formLabel}>Organisation / affiliation</label>
          <input
            type="text"
            className={formControl}
            placeholder="e.g. chenlabs.org or Chen Logistics Institute"
            value={organisation}
            onChange={(e) => setOrganisation(e.target.value)}
          />
        </div>

        <div className="mb-5">
          <label className={formLabel}>Professional links (one per line)</label>
          <textarea
            rows={3}
            className={formControl}
            placeholder={"https://linkedin.com/in/...\nhttps://orcid.org/..."}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-text-muted">
            LinkedIn, ORCID, a university/company profile, or published work.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className={cn("flex-1")}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await requestVerification({
                  organisation,
                  links: links.split("\n").map((l) => l.trim()).filter(Boolean),
                });
                if ("error" in res) alert(res.error);
                else {
                  onClose();
                  router.refresh();
                }
              })
            }
          >
            {isPending ? "Submitting..." : "Submit application"}
          </Button>
        </div>
      </div>
    </>
  );
}
