/**
 * Platform economics — fees, revenue splits, and marketplace defaults.
 *
 * These are the STARTING DEFAULTS chosen for launch. They are intentionally
 * centralised so they can be tuned without hunting through the codebase, and
 * so they can later be overridden at runtime by an admin-editable
 * `PlatformFeeConfig` row in the database (Phase 5/6). Treat this file as the
 * fallback/seed values.
 *
 * Money is expressed in AUD dollars (not cents) for readability here; the
 * payment layer converts to Stripe's minor units at the boundary.
 */

export const CURRENCY = "AUD" as const;

/** Australian GST. Applied to platform-side charges via Stripe Tax. */
export const GST_RATE = 0.1;

/**
 * Fraction of gross revenue the PLATFORM keeps, per revenue type.
 * The remainder goes to the creator/author (except boosts — see below).
 * All values are 0–1 and adjustable later.
 */
export const PLATFORM_FEES = {
  /** Brand → article sponsorship bids. Author keeps 80%. */
  sponsorship: 0.2,
  /** Premium report / whitepaper sales. Author/publisher keeps 80%. */
  reportSale: 0.2,
  /** Reader donations / micro-grants. Author keeps 95%. */
  donation: 0.05,
  /**
   * Author → placement boosts. The author pays the platform for distribution,
   * so the platform keeps 100% (there is no author payout on a boost).
   */
  placementBoost: 1.0,
} as const;

/**
 * Revenue-share splits that fund creator earnings (author's share of gross).
 */
export const REVENUE_SHARES = {
  /** Author's share of programmatic ad revenue earned on their articles. */
  adRevenueAuthorShare: 0.6,
  /**
   * Portion of net reader-subscription revenue routed into the read-time
   * payout POOL (distributed to authors by verified read-time). Keeps the
   * pool solvent — payouts are always a share of collected revenue.
   */
  subscriptionReadPoolShare: 0.5,
} as const;

/**
 * Marketplace auction & settlement defaults. All overridable per-listing
 * (author-set reserve) or by admin config later.
 */
export const MARKETPLACE_DEFAULTS = {
  /** Auction mechanism: winner pays runner-up + increment (truthful bidding). */
  auctionType: "second-price" as const,

  /** Minimum opening bid for a sponsorship auction (AUD). */
  minBid: 50,
  /** Minimum increment between bids (AUD). */
  bidIncrement: 10,
  /** Author-set reserve; null = no reserve beyond the minimum bid. */
  reservePriceDefault: null as number | null,

  /** How long a sponsorship auction stays open by default (days). */
  auctionDurationDays: 7,
  /** How long a won branding placement stays live on the article (days). */
  placementWindowDays: 30,
  /** Escrow release delay after a placement's live window ends (dispute buffer). */
  escrowHoldDaysAfterCompletion: 7,

  /** Minimum author → placement boost bid (AUD). */
  boostMinBid: 20,

  /** Minimum wallet balance before an author can withdraw (AUD). */
  payoutMinimum: 50,

  /** Automatic refunds. */
  refundIfAuthorRejects: true,
  refundIfNotDelivered: true,
} as const;

/** Reader → author micro-donation defaults. */
export const DONATION_DEFAULTS = {
  /** Suggested one-tap amounts shown in the donation picker (AUD). */
  presetAmounts: [5, 10, 25, 50] as const,
  /** Stripe's practical minimum for an AUD charge. */
  minAmount: 2,
  /** Sanity ceiling — larger support should go through a real invoice, not this button. */
  maxAmount: 500,
} as const;

export type PlatformFeeType = keyof typeof PLATFORM_FEES;
