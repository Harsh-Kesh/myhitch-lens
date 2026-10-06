import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
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
