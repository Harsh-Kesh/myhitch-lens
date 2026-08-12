import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

/**
 * Full Auth.js (NextAuth v5) instance (Node runtime). Extends the edge-safe
 * base config with the Credentials provider that verifies against Postgres.
 *
 * NOTE: the role in the session is the source of truth for authorization —
 * never the client-side localStorage role (now only a UI convenience).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
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
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

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
