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
  "/trust-safety",
  "/magazine",
  "/panel",
  "/article",
];

/**
 * Role-gated areas. A logged-in user whose role is not listed is redirected
 * away (to /explore) rather than shown a page they shouldn't act on. Anything
 * not listed here is open to every signed-in user (reading, marketplace,
 * governance appeals, personal dashboard). Enforced centrally in the edge
 * middleware; server actions re-check as defense-in-depth.
 */
const ROLE_RULES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/editorial", roles: ["editor", "admin"] },
  { prefix: "/trust-safety", roles: ["editor", "admin"] },
  { prefix: "/magazine", roles: ["editor", "admin"] },
  { prefix: "/submit", roles: ["author", "editor", "admin"] },
  { prefix: "/analytics", roles: ["author", "editor", "admin"] },
  { prefix: "/author-dashboard", roles: ["author", "editor", "admin"] },
  // Not author-facing: these toggles are a single, platform-wide switch (no
  // per-author or per-article scoping behind them yet), so exposing them to
  // authors implies personal control that doesn't actually exist.
  { prefix: "/integrations", roles: ["editor", "admin"] },
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

      if (isLoggedIn) {
        const role = (auth!.user as { role?: UserRole }).role;
        const rule = ROLE_RULES.find(
          (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
        );
        if (rule && (!role || !rule.roles.includes(role))) {
          // Logged in but wrong role → send to the universal feed.
          return Response.redirect(new URL("/explore", request.nextUrl));
        }
      }
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
