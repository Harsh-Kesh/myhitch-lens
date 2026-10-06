"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { auth, signIn, signOut } from "@/auth";
import { ADMIN_MODE_COOKIE, ADMIN_MODE_PATH } from "@/lib/adminMode";
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
 * Switch the app into / out of Admin mode (a separate dashboard for promoting a
 * subscription package; NOT the platform admin role). It only sets a UI
 * preference cookie and changes no permissions.
 */
export async function enterAdminMode(): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  (await cookies()).set(ADMIN_MODE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(ADMIN_MODE_PATH);
}

export async function leaveAdminMode(): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  (await cookies()).delete(ADMIN_MODE_COOKIE);
  redirect(ROLE_HOME[session.user.role]);
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
