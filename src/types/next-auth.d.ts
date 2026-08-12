import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/** Add `id` and `role` to the session/user and JWT types. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
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
  }
}
