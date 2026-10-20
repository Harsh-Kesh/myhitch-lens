import type { PlanCode, PlanEntitlements } from "@/lib/plans";

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

/** What each package gives, in plain words (only things Lens actually delivers today). */
export const PLAN_HIGHLIGHTS: Record<PlanCode, string[]> = {
  free: [
    "2 article submissions a month",
    "Magazine pages 121–124, 2 pages per article",
    "1 Exchange Hub listing",
    "Basic analytics",
    "Editorial review",
  ],
  creator: [
    "10 article submissions a month",
    "Magazine pages 57–120, 2 pages per article",
    "5 Exchange Hub listings",
    "Verified Author badge",
    "Standard analytics",
  ],
  professional: [
    "Unlimited submissions",
    "Magazine pages 9–120, up to 3 pages per article",
    "Unlimited Exchange Hub listings",
    "Monetisation and sponsored articles",
    "Priority editorial review",
    "Advanced analytics and audience insights",
  ],
  business: [
    "Everything in Professional",
    "Magazine pages 9–120, up to 4 pages per article",
    "Unlimited Exchange Hub listings",
    "5 team seats, extra users AU$5/month",
  ],
};

