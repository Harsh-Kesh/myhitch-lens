import { auth } from "@/auth";
import { LockedFeature } from "@/components/ui/LockedFeature";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { prisma } from "@/lib/prisma";
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

  // A company member sees the whole team's analytics, and only with Lens Business.
  if (session!.user.role === "corporate") {
    const entitlements = await getEntitlements(session!.user.id);
    const membership = await prisma.orgMembership.findFirst({ where: { userId: session!.user.id }, select: { orgId: true } });
    if (!membership || entitlements.analytics !== "advanced") {
      return (
        <>
          <ViewHeader title="Analytics Hub" subtitle="Performance of your whole team's published articles." />
          <LockedFeature title="Team analytics" plan="Lens Business" description="Advanced analytics across every author in your company." />
        </>
      );
    }
    const members = await prisma.orgMembership.findMany({ where: { orgId: membership.orgId }, select: { userId: true } });
    const ids = members.map((m) => m.userId);
    const [teamData, teamInsights] = await Promise.all([
      getAnalyticsData(ids),
      entitlements.audienceInsights ? getAudienceInsights(ids) : Promise.resolve(null),
    ]);
    return (
      <AuthorAnalyticsView
        data={teamData}
        level={entitlements.analytics}
        insights={teamInsights}
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
