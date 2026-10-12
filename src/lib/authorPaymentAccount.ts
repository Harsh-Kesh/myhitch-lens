import "server-only";

import { loadPortalStripeAccount } from "@/lib/portalDb";
import { prisma } from "@/lib/prisma";

/**
 * Resolve the Stripe Connect account that money for a given author must go to.
 *
 * The account is owned by the MYHitch Business portal and is read LIVE from the
 * portal on every call; Lens keeps no copy. The link is the author's
 * PlatformIdentity (Auth0 user id) -> portal profile -> stripe_accounts row.
 *
 * Fail closed. "Portal unavailable" and "author hasn't set up payouts" are
 * different outcomes, but BOTH refuse the payment: there is no fallback to
 * another account or to Lens's own Stripe platform.
 *
 * `authorUserId` must come from the DB row of the thing being paid for (the
 * article's author), never from the signed-in payer or the browser.
 */
export type AuthorAccount =
  | { ok: true; accountId: string; chargesEnabled: boolean; payoutsEnabled: boolean }
  | { ok: false; reason: "unavailable" | "not_ready"; message: string };

const UNAVAILABLE: AuthorAccount = {
  ok: false,
  reason: "unavailable",
  message: "Payments are temporarily unavailable. Please try again shortly.",
};

const NOT_READY: AuthorAccount = {
  ok: false,
  reason: "not_ready",
  message: "This author hasn't finished payout setup yet.",
};

export async function resolveAuthorAccount(authorUserId: string): Promise<AuthorAccount> {
  try {
    const identity = await prisma.platformIdentity.findUnique({
      where: { userId: authorUserId },
      select: { myhitchId: true },
    });
    if (!identity) return NOT_READY; // never signed in through the portal

    const account = await loadPortalStripeAccount(identity.myhitchId);
    if (!account) return NOT_READY; // no portal Stripe account yet

    return {
      ok: true,
      accountId: account.accountId,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
    };
  } catch (error) {
    // Portal DB down/misconfigured, or Lens's own DB error: never guess.
    console.error("[stripe] could not resolve author payment account", {
      error: error instanceof Error ? error.message : String(error),
    });
    return UNAVAILABLE;
  }
}

/** True when the author can currently receive card payments (used to show/hide the donate button). */
export async function canReceiveDonations(authorUserId: string): Promise<boolean> {
  const account = await resolveAuthorAccount(authorUserId);
  return account.ok && account.chargesEnabled;
}
