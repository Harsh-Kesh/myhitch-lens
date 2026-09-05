import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { listAuthorOpportunities, listExchangeEligibleArticles } from "@/lib/exchange";
import { listActiveExternalOpportunities, listAllExternalOpportunities } from "@/lib/externalOpportunities";
import { ExchangeHub } from "./ExchangeHub";
import { ExternalOpportunitiesBoard } from "./ExternalOpportunitiesBoard";
import { ExternalOpportunitiesAdmin } from "./ExternalOpportunitiesAdmin";

/**
 * Author-facing submission + tracking view for the Exchange Hub pipeline,
 * plus a board of external briefs (MYHitch Mart / other MYHitch products).
 * Admin sees a separate management view for posting those briefs instead.
 */
export default async function ExchangePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  if (session.user.role === "admin") {
    const opportunities = await listAllExternalOpportunities();
    return <ExternalOpportunitiesAdmin opportunities={opportunities} />;
  }

  const [listable, opportunities, externalOpportunities] = await Promise.all([
    listExchangeEligibleArticles(session.user.id),
    listAuthorOpportunities(session.user.id),
    listActiveExternalOpportunities(),
  ]);

  return (
    <>
      <ExchangeHub listable={listable} opportunities={opportunities} />
      <div className="mt-6">
        <ExternalOpportunitiesBoard opportunities={externalOpportunities} />
      </div>
    </>
  );
}
