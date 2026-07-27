"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { articlesGrid } from "@/components/ui/ArticleCard";
import {
  BarChartIcon,
  BoxesIcon,
  BriefcaseIcon,
  CoffeeIcon,
  CpuIcon,
  GraduationCapIcon,
  MonitorIcon,
  PulseIcon,
  SearchCircleIcon,
  SendIcon,
  UsersGroupIcon,
} from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";

const categoryIcon = "size-6 text-primary";

const CATEGORIES: { name: string; icon: ReactNode; count: number; desc: string }[] = [
  {
    name: "Business",
    icon: <BriefcaseIcon className={categoryIcon} />,
    count: 12,
    desc: "Market updates, company profiles, and corporate strategy.",
  },
  {
    name: "Supply Chain",
    icon: <BoxesIcon className={categoryIcon} />,
    count: 8,
    desc: "Logistics corridors, fleet telemetry, near-shoring, and risk models.",
  },
  {
    name: "Technology",
    icon: <MonitorIcon className={categoryIcon} />,
    count: 15,
    desc: "Hardware development, systems architecture, and engineering designs.",
  },
  {
    name: "AI",
    icon: <CpuIcon className={categoryIcon} />,
    count: 24,
    desc: "Deep learning models, predictive telemetry, LLMs, and quantum networks.",
  },
  {
    name: "Healthcare",
    icon: <PulseIcon className={categoryIcon} />,
    count: 9,
    desc: "Telemedicine, data compliance in clinical systems, and bio-tech reports.",
  },
  {
    name: "Education",
    icon: <GraduationCapIcon className={categoryIcon} />,
    count: 6,
    desc: "E-learning structures, educational accessibility, and academic workflows.",
  },
  {
    name: "Travel",
    icon: <SendIcon className={categoryIcon} />,
    count: 5,
    desc: "Geographic logs, aviation logistics, Sustainable Aviation Fuels (SAF).",
  },
  {
    name: "Finance",
    icon: <BarChartIcon className={categoryIcon} />,
    count: 14,
    desc: "Monte Carlo risk estimations, derivatives, and decentralized ledgers.",
  },
  {
    name: "Lifestyle",
    icon: <CoffeeIcon className={categoryIcon} />,
    count: 11,
    desc: "Remote work culture, wellness design, and creative publishing.",
  },
  {
    name: "Research",
    icon: <SearchCircleIcon className={categoryIcon} />,
    count: 18,
    desc: "Academic research papers, laboratory records, and scientific compliance.",
  },
  {
    name: "Community",
    icon: <UsersGroupIcon className={categoryIcon} />,
    count: 21,
    desc: "Discussions, expert panels, and contributor governance reviews.",
  },
];

export default function CategoriesPage() {
  return (
    <>
      <ViewHeader
        title="Content Categories"
        subtitle="Select a niche operational sector to explore peer-reviewed works."
      />

      <div className={articlesGrid}>
        {CATEGORIES.map((category) => (
          /* `.category-card` */
          <Link
            key={category.name}
            href={`/explore?category=${encodeURIComponent(category.name)}`}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-line bg-bg-secondary p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-card"
          >
            <div className="flex size-15 items-center justify-center rounded-full bg-primary-glow text-[32px]">
              {category.icon}
            </div>
            <span className="text-base font-bold">{category.name}</span>
            <p className="text-xs text-text-muted">{category.desc}</p>
            <span className="rounded-[10px] bg-primary-glow px-2 py-0.5 text-[11px] font-bold text-primary">
              {category.count} Publications
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
