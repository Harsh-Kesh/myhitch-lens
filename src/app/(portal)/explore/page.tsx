"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { ArticleCard, articlesGrid } from "@/components/ui/ArticleCard";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { useLensValue } from "@/hooks/useLensValue";
import { getArticles } from "@/lib/lensStore";
import { cn } from "@/lib/cn";
import { defaultArticles } from "@/data/defaults";
import { CATEGORY_FILTERS } from "@/data/categories";

/** "All" + the 11 canonical categories (single source of truth). */
const CATEGORIES = CATEGORY_FILTERS;

const CATEGORY_LABELS: Record<string, string> = { All: "All Categories" };

/** `.category-tag` */
const categoryTag =
  "shrink-0 cursor-pointer rounded-[50px] border px-3.5 py-1.5 text-[12.5px] font-[550] whitespace-nowrap transition-all duration-200";

function ExploreFeed() {
  const searchParams = useSearchParams();
  const routeCategory = searchParams.get("category");

  const articles = useLensValue(getArticles, defaultArticles);
  const [query, setQuery] = useState("");

  /**
   * The pill selection defaults to the `?category=` route param and is
   * overridden once the reader clicks a different pill. `null` means "not
   * chosen yet", so a later navigation with a new param still wins.
   */
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const selectedCategory = pickedCategory ?? routeCategory ?? "All";

  const filtered = useMemo(() => {
    const search = query.toLowerCase();
    return articles.filter((article) => {
      const matchesCategory =
        selectedCategory === "All" ||
        article.category.toLowerCase() === selectedCategory.toLowerCase();
      if (!matchesCategory) return false;
      if (!search) return true;
      return (
        article.title.toLowerCase().includes(search) ||
        article.author.toLowerCase().includes(search) ||
        article.summary.toLowerCase().includes(search)
      );
    });
  }, [articles, selectedCategory, query]);

  return (
    <>
      <ViewHeader
        title="Knowledge Feed"
        subtitle="Trusted research papers, reports, news, and blogs."
        actions={
          <div className="max-[640px]:w-full">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, keywords, authors..."
              className="w-[280px] rounded-lg border border-line bg-bg-secondary px-[18px] py-2.5 text-[13.5px] leading-[normal] text-text-main outline-none focus:border-primary max-[640px]:w-full"
            />
          </div>
        }
      />

      {/* `.category-scroll` */}
      <div className="mb-8 flex gap-2.5 overflow-x-auto pb-2">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setPickedCategory(category)}
            className={cn(
              categoryTag,
              category === selectedCategory
                ? "border-primary bg-primary text-text-inverse"
                : "border-line bg-bg-secondary text-text-muted hover:border-line-hover hover:text-text-main",
            )}
          >
            {CATEGORY_LABELS[category] ?? category}
          </button>
        ))}
      </div>

      <div className={articlesGrid}>
        {filtered.length === 0 ? (
          <p className="col-[1/-1] p-10 text-center text-text-muted">
            No verified articles match this search.
          </p>
        ) : (
          filtered.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))
        )}
      </div>
    </>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreFeed />
    </Suspense>
  );
}
