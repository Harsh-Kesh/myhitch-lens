import { listReviewQueue } from "@/lib/articles";
import { listOpenOpportunitiesForEditors } from "@/lib/exchange";
import { EditorialBoard } from "./EditorialBoard";
import { ExchangeOpportunityQueue } from "./ExchangeOpportunityQueue";

/** Server component: the review queue and Exchange Hub queue are read from the database. */
export default async function EditorialPage() {
  const [queue, opportunities] = await Promise.all([listReviewQueue(), listOpenOpportunitiesForEditors()]);
  return (
    <>
      <EditorialBoard queue={queue} />
      <ExchangeOpportunityQueue opportunities={opportunities} />
    </>
  );
}
