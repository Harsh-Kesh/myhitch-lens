"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";

import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ABN_COUNTRY } from "@/lib/platformConfig";
import { ROLE_HOME } from "@/lib/roleHome";
import { lookupAbn, normalizeAbn } from "@/lib/abn";
import type { UserRole } from "@prisma/client";

export type AuthResult = { error: string } | undefined;

/**
 * Roles a visitor can self-assign at signup. Deliberately excludes "editor"
 * and "admin" — those carry moderation/platform-operation powers and must
 * only be granted internally, never chosen by the signing-up user. "corporate"
 * IS self-assignable: it's how a business signs up to run its own company
 * account (see companyName below) — every sub-account under it is still
 * created internally by that company's owner, never self-signed-up.
 */
function parseRole(value: unknown): UserRole {
  return value === "reader" || value === "author" || value === "corporate" ? value : "reader";
}

export async function registerUser(input: {
  username: string;
  email: string;
  password: string;
  role: string;
  country?: string;
  abn?: string;
  companyName?: string;
}): Promise<AuthResult> {
  // Every exported server action is a directly callable endpoint, whether or not
  // a page links to it. Password sign-up is closed unless the rollback flag is
  // on; otherwise anyone could create password accounts (and squat on other
  // people's emails) without going through the portal.
  if (process.env.ENABLE_PASSWORD_LOGIN !== "true") {
    return { error: "Sign-up now happens through MYHitch. Use the Sign Up button to continue." };
  }
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const role = parseRole(input.role);
  const country = input.country?.trim() || null;
  // Corporate signup collects no country field at all (a company's ABN
  // implies Australia already), so its ABN isn't gated on country the way an
  // individual's is.
  const abnInput =
    role === "corporate" ? input.abn?.trim() || null : country === ABN_COUNTRY ? input.abn?.trim() || null : null;
  const companyName = input.companyName?.trim() || "";

  if (!username || !email || !password) {
    return { error: "Please fill in username, email, and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (role === "corporate" && !companyName) {
    return { error: "Enter your company name." };
  }

  let abn: string | null = null;
  if (abnInput) {
    const check = await lookupAbn(abnInput);
    if (!check.valid) return { error: check.error ?? "That ABN doesn't look valid." };
    abn = normalizeAbn(abnInput);
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    return { error: "That username or email is already registered." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const displayName = input.username.trim();

  // Create the account plus its profile, wallet, and starting rank together.
  // A "corporate" signup additionally stands up the Organization itself, with
  // this account as its owner (isAdmin) — sub-accounts are created later from
  // the company dashboard, never self-signed-up.
  await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role,
      displayName,
      // The ABN belongs to the Organization for a corporate signup — the
      // business being registered — not to the owner's personal Profile.
      profile: { create: { country, abn: role === "corporate" ? null : abn } },
      wallet: { create: {} },
      rank: { create: {} },
      ...(role === "corporate"
        ? {
            memberships: {
              create: {
                isAdmin: true,
                orgRole: "owner",
                org: { create: { name: companyName, abn } },
              },
            },
          }
        : {}),
    },
  });

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: ROLE_HOME[role],
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Could not sign you in." };
    throw error; // redirect
  }
}

export async function loginUser(input: {
  username: string;
  password: string;
}): Promise<AuthResult> {
  const username = input.username.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { username } });
  const redirectTo = user ? ROLE_HOME[user.role] : "/explore";

  try {
    await signIn("credentials", {
      username,
      password: input.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid username or password." };
    }
    throw error; // redirect
  }
}

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
 * configured (password-login rollback accounts have no portal session anyway).
 */
export async function logoutUser(): Promise<void> {
  await signOut({ redirect: false });
  const portal = process.env.NEXT_PUBLIC_PORTAL_URL;
  redirect(portal ? new URL("/api/sso/lens/logout", portal).toString() : "/");
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
