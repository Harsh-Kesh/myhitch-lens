import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

/**
 * Edge-safe base config shared by the middleware and the full Node config.
 * It must NOT import Prisma/bcrypt — the Credentials provider (which does) is
 * added only in `auth.ts`, which runs in the Node runtime.
 */

/** Portal areas that require a logged-in session. */
const PORTAL_PREFIXES = [
  "/explore",
  "/categories",
  "/submit",
  "/analytics",
  "/governance",
  "/integrations",
  "/author-dashboard",
  "/reader-dashboard",
  "/editorial",
  "/article",
];

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/auth" },
  trustHost: true,
  providers: [], // real provider added in auth.ts
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      const isPortal = PORTAL_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      );
      if (isPortal && !isLoggedIn) return false; // → redirect to signIn page
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
