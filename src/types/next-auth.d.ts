import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/** Add `id` and `role` to the session/user and JWT types. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      /** True for a real admin account (may switch between Admin and Author view). */
      canAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: UserRole;
    canAdmin?: boolean;
  }
}
