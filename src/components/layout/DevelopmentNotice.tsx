"use client";

import { useEffect, useRef } from "react";

import { buttonClasses } from "@/components/ui/Button";
import { AlertTriangleIcon, CloseIcon } from "@/components/ui/icons";

/**
 * Scoped to the tab rather than the browser profile: refreshing or moving
 * around the site mid-visit shouldn't re-open the notice, but someone coming
 * back tomorrow should still be told the build is unfinished.
 */
const STORAGE_KEY = "lens.dev-notice-seen";

/** `sessionStorage` throws outright when storage is blocked, so both accesses are guarded. */
function hasSeenNotice(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberNotice(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Nothing to recover from - the notice just shows again on the next load.
  }
}

/**
 * First-load interstitial telling visitors the platform is still being built.
 *
 * Built on <dialog> + `showModal()` so the browser supplies the parts that are
 * easy to get wrong by hand: the top layer, Escape-to-close, the focus trap,
 * and inert content behind it.
 */
export function DevelopmentNotice() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  /**
   * Opening after hydration rather than during render: the server can't know
   * whether this tab has already dismissed the notice, so any markup it emitted
   * for an open dialog would be wrong for half the visitors.
   */
  useEffect(() => {
    if (hasSeenNotice()) return;

    dialogRef.current?.showModal();
    // Left to itself the browser focuses the first focusable descendant - the
    // close button - which both announces the dialog by its dismissal control
    // and paints a focus ring nobody asked for. The card takes the focus
    // instead, so the notice is read out from the top.
    cardRef.current?.focus();
    // A modal dialog blocks interaction behind it, but not scrolling.
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dev-notice-title"
      aria-describedby="dev-notice-body"
      /* Fires for the button, the backdrop and Escape alike, so the dismissal
         is recorded in exactly one place. */
      onClose={() => {
        rememberNotice();
        document.body.style.overflow = "";
      }}
      /* The dialog fills the viewport so it can centre the card, which means
         every click outside the card lands on the dialog element itself. */
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="fixed inset-0 h-full max-h-none w-full max-w-none items-center justify-center bg-transparent p-5 open:flex backdrop:bg-[rgba(15,23,42,0.6)]"
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className="relative w-full max-w-[460px] animate-fade-in rounded-2xl bg-surface-card p-10 text-center shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] outline-none max-[480px]:p-6"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors duration-200 hover:bg-surface-hover hover:text-text-main"
        >
          <CloseIcon className="size-5" />
        </button>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold tracking-wide text-warning uppercase">
          <AlertTriangleIcon className="size-3.5" />
          Preview build
        </span>

        <h2
          id="dev-notice-title"
          className="mt-4 font-heading text-[32px] font-extrabold text-primary max-[480px]:text-[26px]"
        >
          This Site Is
          <br />
          Under Development
        </h2>

        <p id="dev-notice-body" className="mt-3 text-sm text-text-muted">
          You&rsquo;re looking at an early build of MYHitch Lens. Feel free to explore, but
          some features are still being built and may not work yet.
        </p>

        <button
          type="button"
          onClick={close}
          className={buttonClasses("primary", "lg", "mt-7 w-full")}
        >
          Got It, Continue
        </button>
      </div>
    </dialog>
  );
}
