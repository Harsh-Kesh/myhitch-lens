import type { PlanEntitlements } from "@/lib/plans";

/**
 * The headline benefits shown on the plan screens, in order, and how to test each
 * against a plan. `comingSoon` marks benefits the plan promises but Lens has not
 * built yet, so the screens never present a missing tool as available. Remove the
 * flag when the feature ships.
 */
export interface PlanBenefit {
  label: string;
  has: (e: PlanEntitlements) => boolean;
  comingSoon?: boolean;
}

export const PLAN_BENEFITS: PlanBenefit[] = [
  { label: "Verified Author badge", has: (e) => e.verifiedBadge },
  { label: "Standard analytics", has: (e) => e.analytics !== "basic" },
  { label: "Advanced analytics and audience insights", has: (e) => e.analytics === "advanced" && e.audienceInsights },
  { label: "Video and audio embedding", has: (e) => e.videoEmbeds },
  { label: "SEO tools", has: (e) => e.seoTools !== "none", comingSoon: true },
  { label: "Schedule publishing", has: (e) => e.schedulePublishing, comingSoon: true },
  { label: "Sponsored articles (Exchange Hub)", has: (e) => e.sponsoredArticles },
  { label: "Monetisation (earnings and payouts)", has: (e) => e.monetisation },
  { label: "Priority editorial review", has: (e) => e.priorityReview },
  { label: "Business profile and team accounts", has: (e) => e.businessProfile },
];
