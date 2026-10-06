import "server-only";

import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client for the MYHitch Business PORTAL's Supabase project
 * (identity, business profile, Stripe account). This is NOT Lens's own
 * database — that is Prisma / DATABASE_URL.
 *
 * Rules this file enforces:
 *  - Explicit column lists only. Never read id_type, id_number or
 *    business_documents; Lens has no need for identity documents.
 *  - Read-only against business data. The portal is the source of truth.
 *  - The single write is `consumeTicket` (atomic single-use SSO redemption).
 *  - The Auth0 user id only ever comes from a redeemed ticket or from an
 *    authenticated Lens user's PlatformIdentity — never from the browser.
 *  - Callers must tell "portal unavailable" (PortalDbError) apart from "not
 *    found" (null) and fail closed on the former.
 */

/** The portal could not be reached or returned an error. NOT the same as "not found". */
export class PortalDbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalDbError";
  }
}

/** The audience Lens's tickets are minted for by the portal's /api/sso/lens. */
const TICKET_AUDIENCE = "lens";

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.PORTAL_SUPABASE_URL;
  const key = process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new PortalDbError("Portal database is not configured.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export type PortalProfile = {
  profileId: string;
  auth0UserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
};

export type PortalBusiness = {
  legalEntityName: string | null;
  tradingName: string | null;
  abn: string | null;
  reviewStatus: string | null;
};

export type PortalStripeAccount = {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

/** The portal's profile for an Auth0 user, or null if none exists yet. */
export async function loadPortalProfile(auth0UserId: string): Promise<PortalProfile | null> {
  const { data, error } = await db()
    .from("profiles")
    .select("id, auth0_user_id, email, email_verified, display_name")
    .eq("auth0_user_id", auth0UserId)
    .maybeSingle();
  if (error) throw new PortalDbError(error.message);
  if (!data) return null;
  return {
    profileId: data.id as string,
    auth0UserId: data.auth0_user_id as string,
    email: data.email as string,
    emailVerified: data.email_verified === true,
    displayName: (data.display_name as string | null) ?? null,
  };
}

/** The portal business profile (identity-document columns deliberately excluded). */
export async function loadPortalBusiness(profileId: string): Promise<PortalBusiness | null> {
  const { data, error } = await db()
    .from("business_profiles")
    .select("legal_entity_name, trading_name, abn, review_status")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new PortalDbError(error.message);
  if (!data) return null;
  return {
    legalEntityName: (data.legal_entity_name as string | null) ?? null,
    tradingName: (data.trading_name as string | null) ?? null,
    abn: (data.abn as string | null) ?? null,
    reviewStatus: (data.review_status as string | null) ?? null,
  };
}

/** The author's portal-owned Stripe Connect account, read live. Null if none. */
export async function loadPortalStripeAccount(auth0UserId: string): Promise<PortalStripeAccount | null> {
  const profile = await loadPortalProfile(auth0UserId);
  if (!profile) return null;
  const { data, error } = await db()
    .from("stripe_accounts")
    .select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted")
    .eq("profile_id", profile.profileId)
    .maybeSingle();
  if (error) throw new PortalDbError(error.message);
  if (!data) return null;
  return {
    accountId: data.stripe_account_id as string,
    chargesEnabled: data.charges_enabled === true,
    payoutsEnabled: data.payouts_enabled === true,
    detailsSubmitted: data.details_submitted === true,
  };
}

/**
 * Atomically redeem an SSO ticket and return the Auth0 user id it was minted
 * for, or null if it is unknown, expired, already used, or minted for another
 * site. ONE conditional UPDATE … RETURNING: Postgres re-checks the WHERE after
 * taking the row lock, so of N concurrent redemptions exactly one gets a row.
 * Never SELECT-then-UPDATE (that is a replay bug).
 */
export async function consumeTicket(ticket: string): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("sso_tickets")
    .update({ consumed_at: now })
    .eq("token_hash", createHash("sha256").update(ticket).digest("hex"))
    .eq("audience", TICKET_AUDIENCE) // a ticket minted for Pass can never match
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("auth0_user_id")
    .maybeSingle();
  if (error) throw new PortalDbError(error.message);
  return (data?.auth0_user_id as string | undefined) ?? null;
}
