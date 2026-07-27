"use client";

import { useEffect, type ReactNode } from "react";

import { checkAndInitDatabase } from "@/lib/lensStore";

/**
 * Seeds the mock database on first mount, replacing the top-level
 * `checkAndInitDatabase()` call in `shared.js`. It runs in an effect rather
 * than during render so the server pass never touches `localStorage`.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    checkAndInitDatabase();
  }, []);

  return <>{children}</>;
}
