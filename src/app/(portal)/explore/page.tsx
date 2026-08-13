import { Suspense } from "react";

import { ExploreFeed } from "./ExploreFeed";
import { listPublishedArticles } from "@/lib/articles";

/** Server component: articles are read from the database, then filtered client-side. */
export default async function ExplorePage() {
  const articles = await listPublishedArticles();

  return (
    <Suspense fallback={null}>
      <ExploreFeed articles={articles} />
    </Suspense>
  );
}
