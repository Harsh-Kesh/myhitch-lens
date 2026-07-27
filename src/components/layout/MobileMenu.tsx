"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { LANDING_NAV } from "@/components/layout/LandingHeader";
import { buttonClasses } from "@/components/ui/Button";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** `createPortal` needs `document.body`, which only exists after hydration. */
const subscribeToNothing = () => () => {};

/**
 * Replaces `initMobileMenu()` from `shared.js`, which cloned the desktop nav
 * into a slide-in drawer at runtime. Here the drawer is declarative and reads
 * from the same `LANDING_NAV` source as the header.
 */
export function MobileMenu() {
  const pathname = usePathname();

  /**
   * The drawer stores the route it was opened on rather than a bare boolean, so
   * navigating away closes it as a matter of derivation - including on
   * back/forward, which never runs the links' onClick.
   */
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const isOpen = openedPath === pathname;

  const isMounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  // The original locked body scroll while the drawer was open.
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  /**
   * Rotating a phone to landscape can cross the 1024px breakpoint, which hides
   * the toggle and leaves the drawer stranded over the desktop nav. Closing on
   * that transition keeps the two in step.
   */
  useEffect(() => {
    // Matches where `max-[1024px]:` stops applying, so the drawer and the
    // desktop nav never both consider themselves active.
    const query = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => {
      if (query.matches) setOpenedPath(null);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const close = () => setOpenedPath(null);

  /**
   * The drawer is portalled to <body> on purpose. The header carries a
   * `backdrop-filter`, which makes it the containing block for fixed-position
   * descendants - rendering the panel inside it anchored `inset-0` to the
   * header box rather than the viewport, and let the parked (translated-off)
   * panel widen the layout viewport to twice the device width.
   *
   * The outer layer pins to the viewport and clips, so the closed panel sits
   * outside the visible area without contributing any scrollable width. It
   * stays below the header's `z-100` so the logo and the close button remain
   * on top - which is what the panel's header-height top padding leaves room
   * for.
   */
  const drawer = (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-0 z-90 hidden overflow-hidden max-[1024px]:block",
        !isOpen && "pointer-events-none",
      )}
    >
      <div
        className={cn(
          // `100dvh` keeps the panel clear of the collapsing browser chrome on
          // mobile, and the top padding clears whatever height the header has
          // at the current breakpoint.
          "flex h-[100dvh] w-full flex-col overflow-y-auto overscroll-contain bg-bg-primary px-[30px] pt-[calc(var(--header-h)+24px)] pb-10 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] max-[480px]:px-5",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="mb-[30px] flex flex-col gap-5 border-b border-line pb-5">
          {LANDING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={cn(
                "text-lg no-underline",
                pathname === item.href
                  ? "font-bold text-primary"
                  : "font-medium text-text-main",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex w-full flex-col gap-3">
          <Link
            href="/auth?mode=signin"
            onClick={close}
            className={buttonClasses("secondary", "md", "w-full text-center")}
          >
            Sign In
          </Link>
          <Link
            href="/auth?mode=signup"
            onClick={close}
            className={buttonClasses("primary", "md", "w-full text-center")}
          >
            Launch App
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenedPath((open) => (open === pathname ? null : pathname))}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        className="z-110 hidden shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-bg-tertiary p-2.5 text-text-main transition-all duration-200 hover:border-line-hover hover:bg-surface-hover max-[1024px]:flex"
      >
        {isOpen ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
      </button>

      {isMounted && createPortal(drawer, document.body)}
    </>
  );
}
