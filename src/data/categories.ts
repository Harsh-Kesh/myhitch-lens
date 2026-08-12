/**
 * Canonical content taxonomy — the SINGLE SOURCE OF TRUTH for the 11 platform
 * categories defined in the MYHitch Lens Platform Functions spec.
 *
 * Every surface (explore filter, submit form, categories index, landing copy)
 * MUST derive its category list from here so the taxonomy can never drift out
 * of sync again. Order follows the spec.
 */

export interface CategoryMeta {
  /** Display name, also used as the stored `Article.category` value. */
  name: string;
  /** URL-safe identifier for routing/filtering. */
  slug: string;
  /** One-line description shown on the categories index. */
  desc: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    name: "Business",
    slug: "business",
    desc: "Market updates, company profiles, and corporate strategy.",
  },
  {
    name: "Supply Chain",
    slug: "supply-chain",
    desc: "Logistics corridors, fleet telemetry, near-shoring, and risk models.",
  },
  {
    name: "Technology",
    slug: "technology",
    desc: "Hardware development, systems architecture, and engineering designs.",
  },
  {
    name: "AI",
    slug: "ai",
    desc: "Deep learning models, predictive telemetry, LLMs, and quantum networks.",
  },
  {
    name: "Healthcare",
    slug: "healthcare",
    desc: "Telemedicine, data compliance in clinical systems, and bio-tech reports.",
  },
  {
    name: "Education",
    slug: "education",
    desc: "E-learning structures, educational accessibility, and academic workflows.",
  },
  {
    name: "Travel",
    slug: "travel",
    desc: "Geographic logs, aviation logistics, Sustainable Aviation Fuels (SAF).",
  },
  {
    name: "Finance",
    slug: "finance",
    desc: "Monte Carlo risk estimations, derivatives, and decentralized ledgers.",
  },
  {
    name: "Lifestyle",
    slug: "lifestyle",
    desc: "Remote work culture, wellness design, and creative publishing.",
  },
  {
    name: "Research",
    slug: "research",
    desc: "Academic research papers, laboratory records, and scientific compliance.",
  },
  {
    name: "Community",
    slug: "community",
    desc: "Discussions, expert panels, and contributor governance reviews.",
  },
];

/** Just the display names, in spec order. */
export const CATEGORY_NAMES: string[] = CATEGORIES.map((category) => category.name);

/** Names plus the leading "All" pseudo-filter used by the explore feed. */
export const CATEGORY_FILTERS: string[] = ["All", ...CATEGORY_NAMES];
