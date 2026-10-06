import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { consumeTicket } from "@/lib/portalDb";
import { signInPortalUser } from "@/lib/portalSignIn";
import { prisma } from "@/lib/prisma";

// A precomputed bcrypt hash with no matching plaintext, compared against on
// every failed lookup so "unknown username" and "wrong password" take the
// same amount of time — otherwise the missing bcrypt.compare on an unknown
// username is a measurable timing side-channel for username enumeration.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8xRc0OTb0K1WlrBM9uWyfoU/GX7SZW";

/**
 * Legacy username/password provider (and the seeded demo accounts that use it).
 * Registered only when ENABLE_PASSWORD_LOGIN=true: secure by default, so
 * production sign-in is portal SSO only. Set the flag only for the cutover
 * rollback window, then remove it (the provider is deleted in the cleanup phase).
 */
const passwordLoginEnabled = process.env.ENABLE_PASSWORD_LOGIN === "true";

const passwordProvider = Credentials({
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
});

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
    ...(passwordLoginEnabled ? [passwordProvider] : []),
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
