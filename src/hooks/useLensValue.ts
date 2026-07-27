"use client";

import { useSyncExternalStore } from "react";

import { subscribeToLensStore } from "@/lib/lensStore";

/**
 * Subscribes to one value in the localStorage-backed store.
 *
 * localStorage is an external store, so `useSyncExternalStore` is the correct
 * primitive: it renders `serverSnapshot` on the server and during hydration,
 * then swaps to the live value, which keeps markup consistent without an
 * effect-then-setState round trip.
 *
 * `read` must return a stable reference for unchanged data - `lensStore`
 * memoises parsed values per key to guarantee that.
 */
export function useLensValue<T>(read: () => T, serverSnapshot: T): T {
  return useSyncExternalStore(subscribeToLensStore, read, () => serverSnapshot);
}
