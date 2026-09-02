import { auth } from "@/auth";
import { getAnalyticsData, getPlatformAnalytics } from "@/lib/dashboard";
import { AuthorAnalyticsView } from "./AuthorAnalyticsView";
import { PlatformAnalyticsView } from "./PlatformAnalyticsView";

/** Authors see their own portfolio; editors/admins see a platform-wide rollup instead. */
export default async function AnalyticsPage() {
  const session = await auth();
  const isEditor = ["editor", "admin"].includes(session!.user.role);

  if (isEditor) {
    const data = await getPlatformAnalytics();
    return <PlatformAnalyticsView data={data} />;
  }

  const data = await getAnalyticsData(session!.user.id);
  return <AuthorAnalyticsView data={data} />;
}
