import { auth } from "@/auth";
import { getArticle } from "@/lib/articles";
import { getActivePlacement } from "@/lib/marketplace";
import { ArticleView } from "./ArticleView";

/** Server component: fetch the article (and the viewer's like/bookmark state) from the DB. */
export default async function ArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const session = await auth();
  const article = id ? await getArticle(id, session?.user?.id) : null;

  if (!article) {
    return (
      <div className="min-h-[400px] rounded-xl border border-line bg-bg-secondary p-8 max-[640px]:p-5">
        <div className="p-10 text-center text-text-muted">
          <p>Publication not found. It may have been archived or retracted.</p>
        </div>
      </div>
    );
  }

  const placement = await getActivePlacement(article.id);

  return <ArticleView article={article} placement={placement} />;
}
