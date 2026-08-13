"use client";

import { useRouter } from "next/navigation";

import { CheckIcon, ClockIcon, HeartIcon } from "@/components/ui/icons";
import type { FeedArticle } from "@/lib/types";

/** `.article-card` - the feed tile rendered by `renderFeed()` in the old build. */
export function ArticleCard({ article }: { article: FeedArticle }) {
  const router = useRouter();

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/article?id=${article.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/article?id=${article.id}`);
        }
      }}
      className="flex cursor-pointer flex-col rounded-xl border border-line bg-bg-secondary p-6 transition-all duration-300 hover:-translate-y-1 hover:border-line-hover hover:shadow-card max-[480px]:p-5"
    >
      <div className="mb-3 flex items-center justify-between text-[11px] font-semibold">
        <span className="text-primary uppercase">{article.category}</span>
        <span className="rounded bg-bg-tertiary px-2 py-0.5 text-text-muted">
          {article.type}
        </span>
      </div>

      <h3 className="mb-3 font-heading text-lg leading-[1.35] font-bold text-text-main">
        {article.title}
      </h3>

      <p className="mb-5 line-clamp-3 flex-1 text-[13px] text-text-muted">
        {article.summary}
      </p>

      <div className="flex items-center justify-between border-t border-line pt-3">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-line text-[11px] font-bold">
            {article.author.charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold">{article.author}</span>
            {article.verified && (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-success">
                <CheckIcon className="size-2.5 align-middle" strokeWidth={3} /> Verified
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11.5px] text-text-muted">
          <span className="inline-flex items-center gap-1">
            <HeartIcon className="size-3 align-middle" /> {article.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3 align-middle" />{" "}
            {article.readTime.split(" ")[0]}m
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * `.articles-grid` - the `min()` floor matters: a bare `minmax(320px, 1fr)`
 * keeps a 320px track even when the container is narrower, which pushes the
 * whole feed off the side of a 320px phone.
 */
export const articlesGrid =
  "grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-6 max-[480px]:gap-4";
