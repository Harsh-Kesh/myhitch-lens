import { auth } from "@/auth";
import { LockedFeature } from "@/components/ui/LockedFeature";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { getAnalyticsData, getAudienceInsights, getPlatformAnalytics, getTeamAnalytics } from "@/lib/dashboard";
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

  // A company member sees the whole team's analytics, and only with Lens Business.
  if (session!.user.role === "corporate") {
    const team = await getTeamAnalytics(session!.user.id);
    if (!team) {
      return (
        <>
          <ViewHeader title="Analytics Hub" subtitle="Performance of your whole team's published articles." />
          <LockedFeature title="Team analytics" plan="Lens Business" description="Advanced analytics across every author in your company." />
        </>
      );
    }
    return (
      <AuthorAnalyticsView
        data={team.data}
        level={team.level}
        insights={team.insights}
        title="Team Analytics"
        subtitle="Engagement, reads and revenue across every author in your company."
      />
    );
  }

  const [data, entitlements] = await Promise.all([
    getAnalyticsData(session!.user.id),
    getEntitlements(session!.user.id),
  ]);
  const insights = entitlements.audienceInsights ? await getAudienceInsights(session!.user.id) : null;
  return <AuthorAnalyticsView data={data} level={entitlements.analytics} insights={insights} />;
}
