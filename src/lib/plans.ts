/**
 * The Lens plan catalogue: prices and the benefits each plan unlocks.
 *
 * This is the single source of truth for what a plan includes. It is plain data
 * (no server imports) so both the pricing page and server-side enforcement read
 * the same values. Keep it in step with the marketing copy on /pricing.
 *
 * Each benefit is an ENTITLEMENT. Some are enforced by existing Lens features
 * (submission limit, sponsored articles via the Exchange Hub, marketplace
 * listings, verified badge, team seats). Others describe tools that are not
 * built yet (AI assistant, SEO tools, grammar check, ad campaigns, lead
 * generation, custom branding); those are recorded here so a customer's plan is
 * accurate today and the feature only has to read its flag when it ships.
 */

import { MAGAZINE_SECTIONS, type PageRange } from "@/lib/magazineLayout";

export const PLAN_CODES = ["free", "creator", "professional", "business"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export type BillingInterval = "month" | "year";

export interface PlanEntitlements {
  /** Articles an author may submit per calendar month; null = unlimited. */
  monthlySubmissions: number | null;
  /** Video and audio embeds inside articles (enforced: editor toolbar, upload and save/submit). */
  videoEmbeds: boolean;
  /** SEO tooling (flag: not built yet). */
  seoTools: "none" | "basic" | "advanced";
  /** Schedule publishing for authors (flag: not built yet). */
  schedulePublishing: boolean;
  /** Depth of the Analytics Hub. */
  analytics: "basic" | "standard" | "advanced";
  /** AI writing assistance level (flag: not built yet). */
  aiAssistant: "limited" | "standard" | "advanced";
  /** Grammar and style check (flag: not built yet). */
  grammarCheck: boolean;
  /** May carry the Verified Author badge once the profile checklist is complete. */
  verifiedBadge: boolean;
  /** May list articles for sale on the marketplace (monetisation tools). */
  monetisation: boolean;
  /** Has access to the Exchange Hub (requesting sponsorships). How many listings is `exchangeListings`. */
  sponsoredArticles: boolean;
  /** Exchange Hub listings an author may have in play at once; null = unlimited, 0 = no access. */
  exchangeListings: number | null;
  /** The magazine pages (of 128) this plan's articles can be placed on. */
  magazineRange: PageRange;
  /** Most magazine pages one approved article may take up (enforced at submission). */
  maxPagesPerArticle: number;
  /** Branded company / organisation profile and team accounts. */
  businessProfile: boolean;
  /** Editorial review queue priority. */
  priorityReview: boolean;
  /** MYHitch ecosystem promotion (flag: not built yet). */
  ecosystemPromotion: "none" | "standard" | "priority";
  /** Author audience insights (flag: not built yet). */
  audienceInsights: boolean;
  /** May request custom article categories (flag: not built yet). */
  customCategories: boolean;
  /** Seats included for a company (author/user accounts); 0 when not a team plan. */
  includedSeats: number;
  /** Advertising campaign tools (flag: not built yet; separate fees apply). */
  adCampaignTools: boolean;
  /** Lead generation tools (flag: not built yet). */
  leadGeneration: boolean;
  /** Custom branding options (flag: not built yet). */
  customBranding: boolean;
  /** Dedicated account support. */
  dedicatedSupport: boolean;
}

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  /** Prices in AUD cents; null = not purchasable (free). */
  monthlyCents: number | null;
  yearlyCents: number | null;
  entitlements: PlanEntitlements;
}

/**
 * Price of each additional company user on the Business plan. A Stripe
 * subscription can only mix prices that bill on the same interval, so the add-on
 * has a monthly price and a yearly price (12 x the monthly one).
 */
export const EXTRA_SEAT_MONTHLY_CENTS = 500;
export const EXTRA_SEAT_YEARLY_CENTS = EXTRA_SEAT_MONTHLY_CENTS * 12;

/** Most extra users one company can add (a sanity ceiling, not a product limit). */
export const MAX_EXTRA_SEATS = 95;

const FREE: PlanEntitlements = {
  monthlySubmissions: 2,
  videoEmbeds: false,
  seoTools: "none",
  schedulePublishing: false,
  analytics: "basic",
  aiAssistant: "limited",
  grammarCheck: false,
  verifiedBadge: false,
  monetisation: false,
  // Free can use the Exchange Hub, but with a single listing at a time.
  sponsoredArticles: true,
  exchangeListings: 1,
  // Free contributors are featured only in their own block, 121-124: room for two 2-page articles.
  magazineRange: { from: MAGAZINE_SECTIONS.contributors.from, to: MAGAZINE_SECTIONS.contributors.to },
  maxPagesPerArticle: 2,
  businessProfile: false,
  priorityReview: false,
  ecosystemPromotion: "none",
  audienceInsights: false,
  customCategories: false,
  includedSeats: 0,
  adCampaignTools: false,
  leadGeneration: false,
  customBranding: false,
  dedicatedSupport: false,
};

// Professional and Business page caps follow the plan chart; their Exchange Hub access is
// unchanged until each plan is reviewed in turn.
const CREATOR: PlanEntitlements = {
  ...FREE,
  // Creator: five Exchange Hub listings at a time, and the middle editorial pages (57-120).
  exchangeListings: 5,
  magazineRange: { from: MAGAZINE_SECTIONS.middle.from, to: MAGAZINE_SECTIONS.middle.to },
  monthlySubmissions: 10,
  videoEmbeds: true,
  seoTools: "basic",
  schedulePublishing: true,
  analytics: "standard",
  aiAssistant: "standard",
  grammarCheck: true,
  verifiedBadge: true,
};

const PROFESSIONAL: PlanEntitlements = {
  ...CREATOR,
  monthlySubmissions: null,
  seoTools: "advanced",
  analytics: "advanced",
  aiAssistant: "advanced",
  monetisation: true,
  sponsoredArticles: true,
  exchangeListings: null,
  // Any contributor editorial page (9-120), premium section first. 121-124 stays Free-only.
  magazineRange: { from: MAGAZINE_SECTIONS.premium.from, to: MAGAZINE_SECTIONS.middle.to },
  maxPagesPerArticle: 3,
  priorityReview: true,
  ecosystemPromotion: "standard",
  audienceInsights: true,
  customCategories: true,
};

const BUSINESS: PlanEntitlements = {
  ...PROFESSIONAL,
  maxPagesPerArticle: 4,
  businessProfile: true,
  ecosystemPromotion: "priority",
  includedSeats: 5,
  adCampaignTools: true,
  leadGeneration: true,
  customBranding: true,
  dedicatedSupport: true,
};

export const PLANS: Record<PlanCode, PlanDefinition> = {
  free: { code: "free", name: "Lens Free", monthlyCents: null, yearlyCents: null, entitlements: FREE },
  creator: { code: "creator", name: "Lens Creator", monthlyCents: 999, yearlyCents: 9900, entitlements: CREATOR },
  professional: {
    code: "professional",
    name: "Lens Professional",
    monthlyCents: 1999,
    yearlyCents: 19900,
    entitlements: PROFESSIONAL,
  },
  business: { code: "business", name: "Lens Business", monthlyCents: 4999, yearlyCents: 49900, entitlements: BUSINESS },
};

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && (PLAN_CODES as readonly string[]).includes(value);
}

export function formatAud(cents: number): string {
  return `AU$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
