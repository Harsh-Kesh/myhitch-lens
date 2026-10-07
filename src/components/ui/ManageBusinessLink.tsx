"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { portalManageHref } from "@/lib/portalLinks";

/**
 * "Edit in MYHitch Business": opens the portal in the SAME tab and sends the
 * user back to this exact page (including its query string) when they finish.
 * The click handler reads the live URL, so article pages like /article?id=… are
 * returned to precisely; the rendered href is the fallback for open-in-new-tab.
 */
export function ManageBusinessLink({ className, children }: { className?: string; children: ReactNode }) {
  const pathname = usePathname();
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL; // inlined at build time
  if (!portalUrl) return null;

  return (
    <a
      href={portalManageHref(portalUrl, pathname)}
      onClick={(event) => {
        event.preventDefault();
        window.location.assign(portalManageHref(portalUrl, window.location.pathname + window.location.search));
      }}
      className={className}
    >
      {children}
    </a>
  );
}
