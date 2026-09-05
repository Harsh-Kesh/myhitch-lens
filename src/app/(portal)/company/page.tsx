import {
  getCompanyOverview,
  listCompanyReviewQueue,
  listMyCompanyArticles,
} from "./actions";
import { CompanyDashboard } from "./CompanyDashboard";

export default async function CompanyPage() {
  const overview = await getCompanyOverview();

  const [articles, reviewQueue] = await Promise.all([
    overview.myRole === "author" ? listMyCompanyArticles() : Promise.resolve([]),
    overview.myRole === "editor" ? listCompanyReviewQueue() : Promise.resolve([]),
  ]);

  return <CompanyDashboard overview={overview} articles={articles} reviewQueue={reviewQueue} />;
}
