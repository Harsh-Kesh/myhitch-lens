import type {
  Article,
  Integrations,
  Notification,
  QueueItem,
} from "@/lib/types";

/**
 * Baseline mock database, ported verbatim from the original `shared.js`.
 * These values seed localStorage on first visit.
 */

export const defaultArticles: Article[] = [
  {
    id: "art-1",
    title: "The Decoupling of Global Supply Chains",
    category: "Supply Chain",
    type: "Report",
    readTime: "5 min read",
    summary:
      "An analysis of multi-shore manufacturing shifts and their impacts on lead times, logistics resilience, and regional warehouse clusters in 2026.",
    content: `Global trade flows are undergoing a profound spatial reorganization. The post-pandemic push for resilience has evolved into active structural decoupling, driven by regulatory changes, tariff structures, and localized risk mitigation.

Key Takeaways:
• Near-shoring is increasing regional warehouse demands by 40% in Central Europe and Mexico.
• Just-in-Case models require holding higher levels of buffer inventory, increasing carrying costs.
• Multi-tier supplier visibility remains the single largest operational gap for Fortune 500 logistics teams.

As organizations adapt, the integration of intelligent telemetry becomes vital. Adopting unified digital ledgers and predictive demand models helps mitigate volatile sea and air freight capacity gaps.`,
    author: "Dr. Sarah Chen",
    authorRank: "Silver Contributor",
    likes: 142,
    bookmarks: 35,
    comments: [
      {
        name: "John Doe",
        date: "2 hours ago",
        text: "Excellent analysis. The MX-US corridor statistics are particularly striking.",
      },
      {
        name: "Elena R.",
        date: "5 hours ago",
        text: "Are you seeing similar warehousing trends in Southeast Asia near-shoring hubs?",
      },
    ],
    verified: true,
    date: "2026-07-18",
  },
  {
    id: "art-2",
    title: "How Generative AI is Transforming Enterprise Logistics",
    category: "AI",
    type: "Research Paper",
    readTime: "7 min read",
    summary:
      "Evaluating deep learning model integrations in predictive fleet scheduling, automated document ingestion, and inventory forecasting optimization.",
    content: `Enterprise logistics relies on thousands of disparate documents—manifests, customs papers, invoices, and shipping certificates. Generative AI models, specifically optimized LLMs, are cutting ingestion friction by up to 90%.

Technical Highlights:
• Optical character validation utilizing transformer networks yields 99.1% parsing accuracy.
• Predictive routing algorithms optimize fuel burn by adjusting paths dynamically based on weather and port congestion data.
• Automated customer notifications translate delivery updates across 12 languages instantly.

However, challenges remain around model hallucinations in critical flight manifests. We explore sandboxing approaches to ensure strict safety boundaries.`,
    author: "Dr. Sarah Chen",
    authorRank: "Gold Contributor",
    likes: 312,
    bookmarks: 89,
    comments: [
      {
        name: "Marcus V.",
        date: "Yesterday",
        text: "Dr. Sarah Chen, my team is currently looking into integrating these transformers for regional ports.",
      },
    ],
    verified: true,
    date: "2026-07-15",
  },
  {
    id: "art-3",
    title: "Quantum Computing Applications in Financial Risk Assessment",
    category: "Finance",
    type: "Research Paper",
    readTime: "12 min read",
    summary:
      "Practical quantum algorithms for simulating Monte Carlo portfolio scenarios with speed-ups over traditional GPU clusters.",
    content: `Modern financial portfolios are subject to non-linear risks that traditional computing grids struggle to model in real time. Quantum estimation algorithms provide a logarithmic speed-up for Monte Carlo risk simulations.

In this research, we detail:
1. Mapping asset correlation matrices to qubit registers.
2. Formulating value-at-risk (VaR) equations as Hamiltonian representations.
3. Benchmarking NISQ-era quantum hardware configurations.

By computing risk metrics in seconds rather than hours, trading desks can dynamically hedge complex derivatives against sudden macroeconomic volatility.`,
    author: "Alex Mercer",
    authorRank: "Contributor",
    likes: 58,
    bookmarks: 14,
    comments: [],
    verified: false,
    date: "2026-07-10",
  },
  {
    id: "art-4",
    title: "Sustainable Flight Operations: Reimagining Jet Fuel Alternatives",
    category: "Travel",
    type: "Blog",
    readTime: "4 min read",
    summary:
      "Analyzing Sustainable Aviation Fuels (SAF) infrastructure, chemical efficiency benchmarks, and cost disparities facing modern airlines.",
    content: `Decarbonizing global aviation is one of the most stubborn engineering challenges of the century. While electric battery systems show promise for short hops, long-haul aviation requires dense chemical fuels. Sustainable Aviation Fuels (SAF) derived from biological waste represent the most viable pathway.

Current Benchmarks:
• SAF reduces lifecycle CO2 emissions by up to 80% compared to conventional jet fuel.
• Production scalability remains low, meeting less than 1% of global demand.
• Price premiums sit at 2x to 4x conventional fuels.

Airlines adopting SAF programs like JetNRest are leading the transition by integrating carbon offsets directly into booking workflows, allowing corporate travelers to subsidize clean fuel allotments.`,
    author: "Dr. Elena Rostova",
    authorRank: "Gold Contributor",
    likes: 204,
    bookmarks: 42,
    comments: [
      {
        name: "FlightPath_Global",
        date: "3 days ago",
        text: "SAF is the future. JetNRest’s booking integrations make this transition tangible for corporate clients.",
      },
    ],
    verified: true,
    date: "2026-07-12",
  },
];

/** Demo review-queue submissions — seeded as real in_review articles by prisma/seed.ts. */
export const defaultQueue: QueueItem[] = [
  {
    id: "rev-1",
    title: "Blockchain Ledgers for Transparent Carbon Offset Tracking",
    author: "Liam Sterling",
    authorRank: "Contributor",
    category: "Research",
    type: "Research Paper",
    submittedDate: "2026-07-20 10:15",
    aiScore: 94,
    plagiarism: "1.2% detected",
    readability: "Good (Flesch: 62)",
    sentiment: "Neutral / Analytical",
    content: `Traditional carbon offsets are plagued by double-counting and lack of verification. By deploying decentralized ledgers on EVM-compatible blockchains, we can tokenized carbon credits. This establishes a single, immutable source of truth.

Every offset certificate is minted as a unique NFT containing verification data (GPS coordinates, satellite imagery, verification dates). The credits are retired permanently when burned on-chain. This provides an audit trail that regulators and ESG reporters can trust.`,
  },
  {
    id: "rev-2",
    title: "Hyperloop Systems: Re-evaluating Urban Passenger Transit Networks",
    author: "Clara Oswald",
    authorRank: "Silver Contributor",
    category: "Technology",
    type: "Report",
    submittedDate: "2026-07-19 15:45",
    aiScore: 88,
    plagiarism: "4.5% detected",
    readability: "Complex (Flesch: 45)",
    sentiment: "Highly Optimistic",
    content: `Hyperloop networks operating in near-vacuum tubes at subsonic speeds could bridge key regional corridors, reducing transit times between major metropolitan hubs to minutes.

This report models energy consumption, infrastructure costs, and throughput metrics. We compare Hyperloop systems with high-speed rail projects. Our models indicate that while initial capital expenditures are 30% higher, operational efficiency and speed offsets this cost within a 12-year window.`,
  },
];

export const defaultIntegrations: Integrations = {
  mart: true,
  services: true,
  travel: false,
  events: true,
  donations: true,
  videos: false,
};

export const defaultNotifications: Notification[] = [
  {
    id: 1,
    type: "publish",
    date: "10 mins ago",
    text: "Dr. Sarah Chen published a new research paper in 'AI'.",
  },
  {
    id: 2,
    type: "system",
    date: "1 hour ago",
    text: "Vetting Board: Contributor rank recalculation complete.",
  },
  {
    id: 3,
    type: "system",
    date: "Yesterday",
    text: "Welcome to MYHitch Lens! Connect your Mart profile to sync link references.",
  },
];

export const defaultBookmarks = ["art-1", "art-2"];

export const defaultFollowed = ["Dr. Sarah Chen", "Dr. Elena Rostova"];
