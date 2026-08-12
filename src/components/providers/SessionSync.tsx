"use client";

import { useEffect } from "react";

import {
  getUserName,
  getUserRole,
  setUserName,
  setUserRole,
} from "@/lib/lensStore";
import type { UserRole } from "@/lib/types";

/**
 * Bridges the real Auth.js session into the existing localStorage-backed store
 * so all current portal components (sidebar, dashboards) reflect the logged-in
 * account without needing to be refactored yet. Server-side authorization is
 * still governed by the session/middleware — this only keeps the UI in sync.
 */
export function SessionSync({ role, name }: { role: UserRole; name: string }) {
  useEffect(() => {
    if (getUserRole() !== role) setUserRole(role);
    if (getUserName() !== name) setUserName(name);
  }, [role, name]);

  return null;
}
