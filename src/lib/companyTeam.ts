import "server-only";

import type { OrgRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeAbn } from "@/lib/abn";
import { getOrgSeatCapacity, type SeatCapacity } from "@/lib/entitlements";
import { loadPortalBusiness, loadPortalProfile } from "@/lib/portalDb";
import { MAX_EXTRA_SEATS, PLANS } from "@/lib/plans";

/**
 * The company team rules, shared by the website's company dashboard
 * (src/app/(portal)/company/actions.ts) and the MYHitch app (through the hub,
 * src/lib/hubCompany.ts). Callers check who is asking (the owner); these
 * functions apply the rules. `status` is the HTTP status the hub answers with.
 */

export type TeamResult<T = object> = { error: string; status: number } | ({ ok: true } & T);

/**
 * The company's legal name and ABN are owned by the MYHitch Business portal.
 * For the OWNER (who is the portal business holder) read them live, and keep
 * Lens's own Organization row in step so everything else that uses it (slugs,
 * other members' views) stays right. If the portal is unreachable or has no
 * approved business, fall back silently to what Lens already has — never fail
 * the page. Lens never writes back to the portal.
 */
export async function resolveLegalEntity(
  userId: string,
  org: { id: string; name: string; abn: string | null },
): Promise<{ name: string; abn: string | null; fromPortal: boolean }> {
  const local = { name: org.name, abn: org.abn, fromPortal: false };
  try {
    const identity = await prisma.platformIdentity.findUnique({ where: { userId }, select: { myhitchId: true } });
    if (!identity) return local;
    const profile = await loadPortalProfile(identity.myhitchId);
    if (!profile) return local;
    const business = await loadPortalBusiness(profile.profileId);
    const name = business?.legalEntityName || business?.tradingName || null;
    if (business?.reviewStatus !== "approved" || !name) return local;

    const abn = business.abn ? normalizeAbn(business.abn) : null;
    if (name !== org.name || abn !== org.abn) {
      await prisma.organization.update({ where: { id: org.id }, data: { name, abn } });
    }
    return { name, abn, fromPortal: true };
  } catch (error) {
    console.error("[company] portal business lookup failed; using local details", {
      error: error instanceof Error ? error.message : String(error),
    });
    return local;
  }
}

/** Seats taken: members plus invitations not yet accepted. */
export async function seatsInUse(orgId: string): Promise<number> {
  const [memberCount, pendingCount] = await Promise.all([
    prisma.orgMembership.count({ where: { orgId } }),
    prisma.orgInvite.count({ where: { orgId, acceptedAt: null } }),
  ]);
  return memberCount + pendingCount;
}

export interface SeatUsage extends SeatCapacity {
  /** Members plus pending invites. */
  used: number;
  /** Most extra users the owner can buy. */
  maxExtra: number;
  /** Fewest extra users allowed now (the seats in use must still fit; see setExtraSeats). */
  minExtra: number;
}

export async function getSeatUsage(orgId: string, capacity?: SeatCapacity): Promise<SeatUsage> {
  const [cap, used] = await Promise.all([capacity ?? getOrgSeatCapacity(orgId), seatsInUse(orgId)]);
  // Same floor as setExtraSeats: Business's included seats, whether or not it's active now.
  const minExtra = Math.max(0, used - PLANS.business.entitlements.includedSeats);
  return { ...cap, used, maxExtra: MAX_EXTRA_SEATS, minExtra };
}

/** Invitations not yet accepted, oldest first. */
export async function pendingInvites(orgId: string) {
  return prisma.orgInvite.findMany({
    where: { orgId, acceptedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite someone to the company as an author or editor (the caller has checked
 * they are the owner). No password is set: the invite is activated when that
 * person signs in through the MYHitch Business portal with this same verified
 * email.
 */
export async function inviteToCompany(
  owner: { userId: string; orgId: string },
  input: { email: string; displayName: string; orgRole: string },
): Promise<TeamResult<{ id: string }>> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!email || !displayName) return { error: "Fill in the email and display name.", status: 400 };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address.", status: 400 };
  if (input.orgRole !== "author" && input.orgRole !== "editor") return { error: "Choose a role.", status: 400 };
  const orgRole: OrgRole = input.orgRole;

  // Seats come from the company's Lens Business plan (5 included, plus any extra
  // users the owner pays for). Invites count against seats just like members.
  const capacity = await getOrgSeatCapacity(owner.orgId);
  if (!capacity.onBusiness) {
    return {
      error: "Adding team members is part of the Lens Business plan. Choose Lens Business on the Pricing page to invite your team.",
      status: 403,
    };
  }
  if ((await seatsInUse(owner.orgId)) >= capacity.total) {
    return {
      error: `You've used all ${capacity.total} seats on your plan. Add extra users in Company Details to invite more.`,
      status: 409,
    };
  }

  // One person can only belong to one company, and platform authors/staff keep
  // their own role (an invite never converts them).
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { role: true, memberships: { select: { id: true }, take: 1 } },
  });
  if (existing) {
    if (existing.memberships.length > 0) return { error: "That person already belongs to a company.", status: 409 };
    if (existing.role !== "reader" && existing.role !== "corporate") {
      return { error: "That email belongs to an existing author or staff account and can't be invited.", status: 409 };
    }
  }

  const duplicate = await prisma.orgInvite.findUnique({
    where: { orgId_email: { orgId: owner.orgId, email } },
  });
  if (duplicate && duplicate.acceptedAt === null) return { error: "That email has already been invited.", status: 409 };

  if (duplicate) {
    // A previously accepted invite for this email (member was removed): re-invite.
    await prisma.orgInvite.update({
      where: { id: duplicate.id },
      data: { displayName, orgRole, acceptedAt: null, invitedById: owner.userId, createdAt: new Date() },
    });
    return { ok: true, id: duplicate.id };
  }
  const invite = await prisma.orgInvite.create({
    data: { orgId: owner.orgId, email, displayName, orgRole, invitedById: owner.userId },
    select: { id: true },
  });
  return { ok: true, id: invite.id };
}

/** Cancel a pending invitation of this company. */
export async function revokeCompanyInvite(orgId: string, inviteId: string): Promise<TeamResult> {
  const result = await prisma.orgInvite.deleteMany({
    where: { id: inviteId, orgId, acceptedAt: null },
  });
  if (result.count !== 1) return { error: "That invitation no longer exists.", status: 404 };
  return { ok: true };
}
