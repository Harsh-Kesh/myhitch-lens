import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

// A precomputed bcrypt hash with no matching plaintext, compared against on
// every failed lookup so "unknown username" and "wrong password" take the
// same amount of time — otherwise the missing bcrypt.compare on an unknown
// username is a measurable timing side-channel for username enumeration.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8xRc0OTb0K1WlrBM9uWyfoU/GX7SZW";

/**
 * Full Auth.js (NextAuth v5) instance (Node runtime). Extends the edge-safe
 * base config with the Credentials provider that verifies against Postgres.
 *
 * NOTE: the role in the session is the source of truth for authorization —
 * never the client-side localStorage role (now only a UI convenience).
 */
export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = String(credentials?.username ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user?.passwordHash || !valid) return null;

        return {
          id: user.id,
          name: user.displayName,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
