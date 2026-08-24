import { auth } from "@/auth";
import {
  listAuthorListings,
  listListableArticles,
  listOpenPanelListings,
} from "@/lib/marketplace";
import { CATEGORIES } from "@/data/categories";
import { PanelMarketplace } from "./PanelMarketplace";

/** Server component: the stakeholder marketplace (sponsorship bidding panel). */
export default async function PanelPage() {
  const session = await auth();
  // The portal layout redirects unauthenticated users; return early so this
  // page doesn't crash during the layout/page concurrent render.
  if (!session?.user) return null;
  const userId = session.user.id;

  const [open, mine, listable] = await Promise.all([
    listOpenPanelListings(userId),
    listAuthorListings(userId),
    listListableArticles(userId),
  ]);

  return (
    <PanelMarketplace
      open={open}
      mine={mine}
      listable={listable}
      categories={CATEGORIES.map((c) => c.name)}
    />
  );
}
