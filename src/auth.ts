import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { consumeTicket } from "@/lib/portalDb";
import { signInPortalUser } from "@/lib/portalSignIn";

/**
 * Full Auth.js (NextAuth v5) instance (Node runtime). Extends the edge-safe
 * base config with the portal SSO provider (the only way to sign in).
 *
 * NOTE: the role in the session is the source of truth for authorization —
 * never the client-side localStorage role (now only a UI convenience).
 */
export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = ((await authConfig.callbacks.jwt(params)) ?? params.token) as JWT;

      // A session UPDATE can be triggered with arbitrary data by any signed-in
      // browser (POST /api/auth/session), so the payload is never trusted. The
      // role always comes from the database. The ONLY thing a caller may pick is,
      // for a real admin, whether to VIEW the app as "author" or "admin".
      if (params.trigger === "update" && token.uid) {
        const row = await prisma.user.findUnique({ where: { id: token.uid }, select: { role: true } });
        if (row) {
          const requested = (params.session as { user?: { role?: string } } | undefined)?.user?.role;
          token.canAdmin = row.role === "admin";
          token.role =
            row.role === "admin" && (requested === "author" || requested === "admin") ? requested : row.role;
        }
      }
      return token;
    },
  },
  providers: [
    // MYHitch Business portal SSO. The ONLY credential is a one-time ticket the
    // portal minted for "lens"; it is redeemed atomically against the portal DB
    // and then the Lens user is found, linked or created. `intent` is an
    // unauthenticated UI hint, validated again inside signInPortalUser.
    Credentials({
      id: "portal-sso",
      name: "MYHitch",
      credentials: { ticket: {}, intent: {} },
      authorize: async (credentials) => {
        const ticket = String(credentials?.ticket ?? "");
        if (!ticket) return null;

        let auth0UserId: string | null;
        try {
          auth0UserId = await consumeTicket(ticket);
        } catch (error) {
          console.error("[sso] ticket redemption failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          return null; // portal unavailable → fail closed
        }
        if (!auth0UserId) return null; // unknown, expired, used, or wrong audience

        const user = await signInPortalUser(auth0UserId, String(credentials?.intent ?? ""));
        return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
      },
    }),
  ],
});
