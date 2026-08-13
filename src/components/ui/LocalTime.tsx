"use client";

import { useEffect, useState } from "react";

/**
 * Renders a UTC ISO timestamp in the viewer's local timezone. Mount-guarded so
 * the server (UTC) and first client render agree, avoiding a hydration mismatch.
 */
export function LocalTime({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <>{iso.slice(0, dateOnly ? 10 : 16).replace("T", " ")}</>;

  const d = new Date(iso);
  return (
    <>
      {dateOnly
        ? d.toLocaleDateString(undefined, { dateStyle: "medium" })
        : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
    </>
  );
}
