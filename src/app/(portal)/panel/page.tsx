import { auth } from "@/auth";
import {
  listAuthorListings,
  listListableArticles,
  listOpenPanelListings,
  listOwnedArticles,
} from "@/lib/marketplace";
import { CATEGORIES } from "@/data/categories";
import { PanelMarketplace } from "./PanelMarketplace";

/** Server component: the ownership marketplace (article acquisition auctions). */
export default async function PanelPage() {
  const session = await auth();
  // The portal layout redirects unauthenticated users; return early so this
  // page doesn't crash during the layout/page concurrent render.
  if (!session?.user) return null;
  const userId = session.user.id;

  const [open, mine, listable, owned] = await Promise.all([
    listOpenPanelListings(userId),
    listAuthorListings(userId),
    listListableArticles(userId),
    listOwnedArticles(userId),
  ]);

  return (
    <PanelMarketplace
      open={open}
      mine={mine}
      listable={listable}
      owned={owned}
      categories={CATEGORIES.map((c) => c.name)}
    />
  );
}
