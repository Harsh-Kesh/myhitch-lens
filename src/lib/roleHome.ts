import type { UserRole } from "@prisma/client";

/** Where each role lands after authenticating. Shared by sign-in and the SSO landing page. */
export const ROLE_HOME: Record<UserRole, string> = {
  reader: "/reader-dashboard",
  author: "/author-dashboard",
  editor: "/editorial",
  corporate: "/company",
  admin: "/editorial",
};
