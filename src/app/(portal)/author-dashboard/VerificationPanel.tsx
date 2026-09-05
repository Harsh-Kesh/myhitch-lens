"use client";

import Link from "next/link";
import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { VerificationChecklistItem } from "@/lib/verification";

/**
 * Verification is fully automatic — no application, no editor review. This
 * just shows whether the author is verified, and if not, exactly which
 * profile fields still need filling in (see src/lib/verification.ts).
 */
export function VerificationStatus({
  isVerified,
  items,
}: {
  isVerified: boolean;
  items: VerificationChecklistItem[];
}) {
  const [open, setOpen] = useState(false);

  if (isVerified) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-glow px-2 py-0.5 text-[11px] font-semibold text-primary">
        <VerifiedBadge size="xs" /> Verified
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
        Get verified
      </button>
      {open && <ChecklistModal items={items} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChecklistModal({
  items,
  onClose,
}: {
  items: VerificationChecklistItem[];
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} className="w-[min(420px,92vw)]">
      <h3 className="mb-1 flex items-center gap-2 font-heading text-lg font-bold text-text-main">
        <VerifiedBadge size="md" /> Get the Verified badge
      </h3>
      <p className="mb-4 text-[12.5px] text-text-muted">
        Verification is automatic — no application, no waiting. Complete every item below on your
        profile and the blue mark appears immediately.
      </p>

      <ul className="mb-5 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-[13px]">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full",
                item.met ? "bg-success/15 text-success" : "bg-bg-tertiary text-text-muted",
              )}
            >
              {item.met && <CheckIcon className="size-3" strokeWidth={3} />}
            </span>
            <span className={item.met ? "text-text-muted line-through" : "text-text-main"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/profile"
        onClick={onClose}
        className="flex w-full items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-text-inverse shadow-[0_4px_14px_var(--primary-glow)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover"
      >
        Go to My Profile
      </Link>
    </Modal>
  );
}
