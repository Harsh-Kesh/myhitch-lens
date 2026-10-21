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
/**
 * Local-testing shortcut: signs in as DEV_LOGIN_EMAIL without the portal. It is
 * registered ONLY under `next dev` (NODE_ENV === "development") AND when
 * DEV_LOGIN_EMAIL is set, so a production build can never expose it.
 */
const devLoginEmail =
  process.env.NODE_ENV === "development" ? process.env.DEV_LOGIN_EMAIL?.trim().toLowerCase() : undefined;

async function devLoginUser(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  // No account yet: create a plain author. A later real portal sign-in with this
  // verified email links to this row (see portalSignIn step 3).
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24) || "dev";
  return prisma.user.create({
    data: {
      username: `${base}_${Math.floor(1000 + Math.random() * 9000)}`,
      email,
      emailVerified: new Date(),
      passwordHash: null,
      role: "author",
      displayName: base,
      profile: { create: {} },
      wallet: { create: {} },
      rank: { create: {} },
    },
  });
}

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = ((await authConfig.callbacks.jwt(params)) ?? params.token) as JWT;

      // A session UPDATE can be triggered with arbitrary data by any signed-in
      // browser (POST /api/auth/session), so the payload is never trusted: the
      // role is always re-read from the database.
      if (params.trigger === "update" && token.uid) {
        const row = await prisma.user.findUnique({ where: { id: token.uid }, select: { role: true } });
        if (row) token.role = row.role;
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

        const user = await signInPortalUser(auth0UserId);
        return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
      },
    }),
    ...(devLoginEmail
      ? [
          Credentials({
            id: "dev-login",
            name: "Dev login",
            credentials: {},
            authorize: async () => {
              const user = await devLoginUser(devLoginEmail);
              if (user.suspended) return null;
              return { id: user.id, name: user.displayName, email: user.email, role: user.role };
            },
          }),
        ]
      : []),
  ],
});
