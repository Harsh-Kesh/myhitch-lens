import "server-only";

import { Prisma, type UserRole } from "@prisma/client";

import { normalizeAbn } from "@/lib/abn";
import {
  loadPortalBusiness,
  loadPortalProfile,
  PortalDbError,
  type PortalProfile,
} from "@/lib/portalDb";
import { prisma } from "@/lib/prisma";
import { syncVerification } from "@/lib/verification";

/** What Auth.js needs from a successful portal sign-in. */
export type PortalSignedInUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

/**
 * New accounts start as "author". "corporate" is granted only when the portal
 * says the business is approved (see `resolveNewUserRole`); the browser's role
 * hint can never raise it. "editor" and "admin" are never assignable through
 * SSO: staff are promoted internally (scripts/grantRole.ts).
 */

const MAX_USERNAME_ATTEMPTS = 8;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toSignedIn(user: {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
}): PortalSignedInUser {
  return { id: user.id, name: user.displayName, email: user.email, role: user.role };
}

/** `jane.doe+x@example.com` → `jane_doe_x`. Lens usernames are lower-case [a-z0-9_]. */
function usernameBase(email: string, displayName: string | null): string {
  const local = email.split("@")[0] || displayName || "user";
  const base = local.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (base || "user").slice(0, 24);
}

async function uniqueUsername(email: string, displayName: string | null): Promise<string> {
  const base = usernameBase(email, displayName);
  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
    const suffix = attempt === 0 ? "" : `_${Math.floor(1000 + Math.random() * 9000)}`;
    const candidate = `${base}${suffix}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  throw new Error("Could not allocate a unique username.");
}

/**
 * Decide the role of a brand-new Lens user.
 *  - "corporate" is NEVER taken from the browser. It requires an APPROVED
 *    portal business with a legal name; that business becomes the Organization.
 *  - Everyone else starts as an author (Lens no longer creates new reader
 *    accounts). Existing accounts keep whatever role they already have.
 */
async function resolveNewUserRole(
  profile: PortalProfile,
  intent: string,
): Promise<{ role: UserRole; org?: { name: string; abn: string | null } }> {
  if (intent === "corporate") {
    const business = await loadPortalBusiness(profile.profileId);
    const name = business?.legalEntityName || business?.tradingName || null;
    if (business?.reviewStatus === "approved" && name) {
      return { role: "corporate", org: { name, abn: business.abn ? normalizeAbn(business.abn) : null } };
    }
    return { role: "author" }; // not an approved business yet
  }
  return { role: "author" };
}

/**
 * Sign a portal-authenticated person into Lens: find, link or create the Lens
 * user for an Auth0 identity that has ALREADY been proven by a redeemed
 * ticket. Returns null (never throws) when sign-in must be refused; every
 * refusal is logged with an `[sso]` tag.
 *
 *  1. The portal profile must exist and its email must be verified.
 *  2. Already linked (PlatformIdentity.myhitchId)? → that user.
 *  3. A Lens user with the same verified email and NO identity yet? → link it,
 *     mark the email verified, and clear any password (pre-hijack defence: a
 *     squatter may have registered this email with a password they know).
 *     An email already linked to a DIFFERENT identity is refused, never
 *     overwritten.
 *  4. Otherwise create a new user (+ profile, wallet, rank, identity).
 *  5. A pending company invite for the verified email is activated (see
 *     `activatePendingInvite`) on every successful sign-in path.
 *
 * `intent` is an unauthenticated UI hint and is only honoured on creation.
 */
async function findLinkOrCreate(
  auth0UserId: string,
  intent: string,
): Promise<PortalSignedInUser | null> {
  let profile: PortalProfile | null;
  try {
    profile = await loadPortalProfile(auth0UserId);
  } catch (error) {
    if (error instanceof PortalDbError) {
      console.error("[sso] portal unavailable during sign-in", { error: error.message });
      return null; // fail closed
    }
    throw error;
  }
  if (!profile) {
    console.error("[sso] no portal profile for ticket subject");
    return null;
  }
  if (!profile.emailVerified) {
    console.error("[sso] refusing sign-in: portal email not verified");
    return null;
  }
  const email = profile.email.trim().toLowerCase();

  // 2. Already linked.
  const linked = await prisma.platformIdentity.findUnique({
    where: { myhitchId: auth0UserId },
    include: { user: true },
  });
  if (linked) return toSignedIn(linked.user);

  // 3. Same verified email.
  const byEmail = await prisma.user.findUnique({
    where: { email },
    include: { platformIdentity: true },
  });
  if (byEmail) {
    if (byEmail.platformIdentity) {
      console.error("[sso] refusing sign-in: email already linked to a different identity", {
        userId: byEmail.id,
      });
      return null;
    }
    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.platformIdentity.create({ data: { userId: byEmail.id, myhitchId: auth0UserId } });
        return tx.user.update({
          where: { id: byEmail.id },
          data: { emailVerified: new Date(), passwordHash: null },
        });
      });
      return toSignedIn(updated);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Lost a race with a concurrent sign-in for the same identity.
      const winner = await prisma.platformIdentity.findUnique({
        where: { myhitchId: auth0UserId },
        include: { user: true },
      });
      return winner ? toSignedIn(winner.user) : null;
    }
  }

  // 4. New user.
  let decided: Awaited<ReturnType<typeof resolveNewUserRole>>;
  try {
    decided = await resolveNewUserRole(profile, intent);
  } catch (error) {
    if (error instanceof PortalDbError) {
      console.error("[sso] portal unavailable while resolving role", { error: error.message });
      return null;
    }
    throw error;
  }

  const displayName = profile.displayName?.trim() || email.split("@")[0] || "Member";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await prisma.user.create({
        data: {
          username: await uniqueUsername(email, profile.displayName),
          email,
          emailVerified: new Date(),
          passwordHash: null,
          role: decided.role,
          displayName,
          profile: { create: {} },
          wallet: { create: {} },
          rank: { create: {} },
          platformIdentity: { create: { myhitchId: auth0UserId } },
          ...(decided.org
            ? {
                memberships: {
                  create: {
                    isAdmin: true,
                    orgRole: "owner",
                    org: { create: { name: decided.org.name, abn: decided.org.abn } },
                  },
                },
              }
            : {}),
        },
      });
      return toSignedIn(created);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Either this identity was just created by a concurrent request, or the
      // generated username collided. Re-check the identity, else retry.
      const winner = await prisma.platformIdentity.findUnique({
        where: { myhitchId: auth0UserId },
        include: { user: true },
      });
      if (winner) return toSignedIn(winner.user);
    }
  }
  console.error("[sso] could not create user after retries");
  return null;
}

/**
 * Join the company that invited this verified email, if any. Runs after every
 * successful sign-in so it also catches people who were invited AFTER they first
 * signed in. Never converts platform authors/editors/admins (their role stays),
 * never moves someone who already belongs to a company, and never creates an
 * owner (owners come only from an approved portal business).
 */
async function activatePendingInvite(user: PortalSignedInUser): Promise<PortalSignedInUser> {
  if (user.role !== "reader" && user.role !== "corporate") return user;
  const email = user.email.trim().toLowerCase();

  const invite = await prisma.orgInvite.findFirst({
    where: { email, acceptedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!invite) return user;

  const alreadyInCompany = await prisma.orgMembership.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (alreadyInCompany) return user;

  try {
    await prisma.$transaction([
      prisma.orgMembership.create({
        data: { orgId: invite.orgId, userId: user.id, orgRole: invite.orgRole, isAdmin: false },
      }),
      prisma.user.update({ where: { id: user.id }, data: { role: "corporate" } }),
      prisma.orgInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    ]);
    return { ...user, role: "corporate" };
  } catch (error) {
    if (isUniqueViolation(error)) return user; // lost a race; membership already exists
    console.error("[sso] could not activate company invite", {
      error: error instanceof Error ? error.message : String(error),
    });
    return user; // sign-in itself still succeeds
  }
}

/**
 * Lens no longer has a Reader mode: everyone is an author, and admins can view
 * the app as author or admin. A legacy reader account is therefore upgraded to
 * author the next time they sign in (same effect as the old "Become an Author"
 * button: no approval, profile and history kept). Company members are already
 * "corporate" by now and are not touched.
 */
async function upgradeLegacyReader(user: PortalSignedInUser): Promise<PortalSignedInUser> {
  if (user.role !== "reader") return user;
  await prisma.user.update({ where: { id: user.id }, data: { role: "author" } });
  await syncVerification(user.id);
  return { ...user, role: "author" };
}

export async function signInPortalUser(
  auth0UserId: string,
  intent = "",
): Promise<PortalSignedInUser | null> {
  const user = await findLinkOrCreate(auth0UserId, intent);
  if (!user) return null;
  return upgradeLegacyReader(await activatePendingInvite(user));
}
