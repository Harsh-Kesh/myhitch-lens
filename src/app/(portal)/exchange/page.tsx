import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LockedFeature } from "@/components/ui/LockedFeature";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { getEntitlements } from "@/lib/entitlements";
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
  if (!session?.user) redirect("/auth/login");

  if (session.user.role === "admin") {
    const opportunities = await listAllExternalOpportunities();
    return <ExternalOpportunitiesAdmin opportunities={opportunities} />;
  }

  // Every plan can list in the Exchange Hub, with a cap on listings at once (Free 1, Creator 5,
  // Professional and Business unlimited). The lock stays as a safeguard for a plan without access.
  const { sponsoredArticles, exchangeListings } = await getEntitlements(session.user.id);
  if (!sponsoredArticles) {
    return (
      <>
        <ViewHeader title="Exchange Hub" subtitle="Line up a sponsor for your articles and pick up briefs from MYHitch products." />
        <LockedFeature
          title="Sponsored articles"
          plan="Lens Professional"
          description="Submit an unpublished article to the Exchange Hub to find a sponsor before it goes live."
        />
      </>
    );
  }

  const [listable, opportunities, externalOpportunities] = await Promise.all([
    listExchangeEligibleArticles(session.user.id),
    listAuthorOpportunities(session.user.id),
    listActiveExternalOpportunities(),
  ]);

  return (
    <>
      <ExchangeHub listable={listable} opportunities={opportunities} listingLimit={exchangeListings} />
      <div className="mt-6">
        <ExternalOpportunitiesBoard opportunities={externalOpportunities} />
      </div>
    </>
  );
}
