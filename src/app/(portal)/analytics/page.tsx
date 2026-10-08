import { auth } from "@/auth";
import { getAnalyticsData, getAudienceInsights, getPlatformAnalytics } from "@/lib/dashboard";
import { getEntitlements } from "@/lib/entitlements";
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

  const [data, entitlements] = await Promise.all([
    getAnalyticsData(session!.user.id),
    getEntitlements(session!.user.id),
  ]);
  const insights = entitlements.audienceInsights ? await getAudienceInsights(session!.user.id) : null;
  return <AuthorAnalyticsView data={data} level={entitlements.analytics} insights={insights} />;
}
