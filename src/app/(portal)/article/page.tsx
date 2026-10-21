import { cache } from "react";

import type { Metadata } from "next";

import { auth } from "@/auth";
import { getArticle } from "@/lib/articles";
import { getOwnership } from "@/lib/marketplace";
import { ArticleView } from "./ArticleView";

type Props = { searchParams: Promise<{ id?: string }> };

// The page and its metadata both need the article; load it once per request.
const loadArticle = cache(async (id: string | undefined) => {
  if (!id) return null;
  const session = await auth();
  return getArticle(id, session?.user?.id);
});

/** Page title and description come from the author's saved search metadata, falling back to the article's own title. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { id } = await searchParams;
  const article = await loadArticle(id);
  if (!article) return {};

  const title = article.seo?.title || article.title;
  return {
    title,
    ...(article.seo?.description ? { description: article.seo.description } : {}),
    ...(article.seo?.keywords.length ? { keywords: article.seo.keywords } : {}),
    openGraph: {
      title,
      ...(article.seo?.description ? { description: article.seo.description } : {}),
      type: "article",
    },
  };
}

/** Server component: fetch the article (and the viewer's like/bookmark state) from the DB. */
export default async function ArticlePage({ searchParams }: Props) {
  const { id } = await searchParams;
  const article = await loadArticle(id);

  if (!article) {
    return (
      <div className="min-h-[400px] rounded-xl border border-line bg-bg-secondary p-8 max-[640px]:p-5">
        <div className="p-10 text-center text-text-muted">
          <p>Publication not found. It may have been archived or retracted.</p>
        </div>
      </div>
    );
  }

  const ownership = await getOwnership(article.id);

  return <ArticleView article={article} ownership={ownership} />;
}
