"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { auth, signIn, signOut, updateSession } from "@/auth";
import { ROLE_HOME } from "@/lib/roleHome";

export type AuthResult = { error: string } | undefined;

/**
 * Final leg of portal SSO: redeem the one-time ticket through the `portal-sso`
 * provider and start the normal Lens session. The ticket is the only credential;
 * `intent` is an unauthenticated UI hint re-validated server-side. Success
 * redirects (thrown by signIn); only failures return here.
 */
export async function completePortalSignIn(ticket: string, intent?: string): Promise<AuthResult> {
  try {
    await signIn("portal-sso", {
      ticket,
      intent: intent ?? "",
      redirectTo: "/auth/landing",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "This sign-in link has expired or was already used. Please try again." };
    }
    throw error; // NEXT_REDIRECT
  }
}

/**
 * Sign out of Lens AND of the MYHitch Business portal. Ending only the Lens
 * session would leave the portal logged in, so the next Login would bounce
 * straight back in (on a shared computer, as the previous person). After the
 * Lens session is cleared we send the browser through the portal's logout leg,
 * which returns to the Lens home page. Falls back to "/" if the portal URL isn't
 * configured.
 */
export async function logoutUser(): Promise<void> {
  await signOut({ redirect: false });
  const portal = process.env.NEXT_PUBLIC_PORTAL_URL;
  redirect(portal ? new URL("/api/sso/lens/logout", portal).toString() : "/");
}

/**
 * Let an admin flip between the Admin and Author views of the app. The session
 * callback re-checks the database, so a non-admin calling this changes nothing.
 */
export async function switchView(view: "author" | "admin"): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if (view !== "author" && view !== "admin") redirect(ROLE_HOME[session.user.role]);
  await updateSession({ user: { role: view } });
  redirect(ROLE_HOME[view]);
}

/** Current authenticated user's role + display name, or null. */
export async function currentSession() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name ?? "",
  };
}
