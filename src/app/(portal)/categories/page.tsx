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
import { useLensValue } from "@/hooks/useLensValue";
import { getArticles } from "@/lib/lensStore";
import { defaultArticles } from "@/data/defaults";
import { CATEGORIES } from "@/data/categories";

const categoryIcon = "size-6 text-primary";

/** Icon per canonical category name (metadata lives in `@/data/categories`). */
const CATEGORY_ICONS: Record<string, ReactNode> = {
  Business: <BriefcaseIcon className={categoryIcon} />,
  "Supply Chain": <BoxesIcon className={categoryIcon} />,
  Technology: <MonitorIcon className={categoryIcon} />,
  AI: <CpuIcon className={categoryIcon} />,
  Healthcare: <PulseIcon className={categoryIcon} />,
  Education: <GraduationCapIcon className={categoryIcon} />,
  Travel: <SendIcon className={categoryIcon} />,
  Finance: <BarChartIcon className={categoryIcon} />,
  Lifestyle: <CoffeeIcon className={categoryIcon} />,
  Research: <SearchCircleIcon className={categoryIcon} />,
  Community: <UsersGroupIcon className={categoryIcon} />,
};

export default function CategoriesPage() {
  const articles = useLensValue(getArticles, defaultArticles);

  /** Real publication counts per category, replacing the old fictional values. */
  const counts = articles.reduce<Record<string, number>>((tally, article) => {
    tally[article.category] = (tally[article.category] ?? 0) + 1;
    return tally;
  }, {});

  return (
    <>
      <ViewHeader
        title="Content Categories"
        subtitle="Select a niche operational sector to explore peer-reviewed works."
      />

      <div className={articlesGrid}>
        {CATEGORIES.map((category) => {
          const count = counts[category.name] ?? 0;
          return (
            /* `.category-card` */
            <Link
              key={category.name}
              href={`/explore?category=${encodeURIComponent(category.name)}`}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-line bg-bg-secondary p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-card"
            >
              <div className="flex size-15 items-center justify-center rounded-full bg-primary-glow text-[32px]">
                {CATEGORY_ICONS[category.name]}
              </div>
              <span className="text-base font-bold">{category.name}</span>
              <p className="text-xs text-text-muted">{category.desc}</p>
              <span className="rounded-[10px] bg-primary-glow px-2 py-0.5 text-[11px] font-bold text-primary">
                {count} {count === 1 ? "Publication" : "Publications"}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
