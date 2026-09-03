import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { listAuthorOpportunities, listExchangeEligibleArticles } from "@/lib/exchange";
import { ExchangeHub } from "./ExchangeHub";

/** Author-facing submission + tracking view for the Exchange Hub pipeline. */
export default async function ExchangePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const [listable, opportunities] = await Promise.all([
    listExchangeEligibleArticles(session.user.id),
    listAuthorOpportunities(session.user.id),
  ]);

  return <ExchangeHub listable={listable} opportunities={opportunities} />;
}
