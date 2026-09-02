"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteDraft } from "../submit/actions";

export function DeleteDraftButton({ draftId, title }: { draftId: string; title: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`Delete "${title || "this draft"}"? This can't be undone.`)) return;
    startTransition(async () => {
      const res = await deleteDraft(draftId);
      if (res && "error" in res) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      aria-label="Delete draft"
      onClick={handleClick}
      disabled={isPending}
      className="ml-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
      </svg>
    </button>
  );
}
