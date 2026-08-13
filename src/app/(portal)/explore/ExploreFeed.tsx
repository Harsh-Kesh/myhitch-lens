"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ArticleCard, articlesGrid } from "@/components/ui/ArticleCard";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import { CATEGORY_FILTERS } from "@/data/categories";
import type { FeedArticle } from "@/lib/types";

const CATEGORIES = CATEGORY_FILTERS;
const CATEGORY_LABELS: Record<string, string> = { All: "All Categories" };

const categoryTag =
  "shrink-0 cursor-pointer rounded-[50px] border px-3.5 py-1.5 text-[12.5px] font-[550] whitespace-nowrap transition-all duration-200";

/** Client-side live filtering over articles fetched server-side from the DB. */
export function ExploreFeed({ articles }: { articles: FeedArticle[] }) {
  const searchParams = useSearchParams();
  const routeCategory = searchParams.get("category");

  const [query, setQuery] = useState("");
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
              className="w-[280px] rounded-lg border border-line bg-bg-secondary px-[18px] py-2.5 text-[13.5px] leading-[normal] text-text-main outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 max-[640px]:w-full"
            />
          </div>
        }
      />

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
          filtered.map((article) => <ArticleCard key={article.id} article={article} />)
        )}
      </div>
    </>
  );
}
