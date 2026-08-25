import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { dashCard, dashHeading, StatChip } from "@/components/ui/DashboardKit";
import { BarChartIcon, BookmarkIcon, DollarSignIcon, HeartIcon } from "@/components/ui/icons";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { getArticleAnalytics } from "@/lib/dashboard";
import { cn } from "@/lib/cn";

function formatAUD(n: number): string {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ArticleAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const session = await auth();
  if (!session?.user) return null;

  const data = id ? await getArticleAnalytics(id) : null;
  if (!data) {
    return (
      <div className="rounded-xl border border-line bg-bg-secondary p-8 text-center text-text-muted">
        Article analytics not found.
      </div>
    );
  }

  // Authors may only see their own article's analytics; editors/admins see any.
  const isReviewer = ["editor", "admin"].includes(session.user.role);
  if (!isReviewer && data.authorId !== session.user.id) redirect("/analytics");

  const maxRevenue = Math.max(...data.revenueByType.map((r) => r.value), 1);
  const maxDayViews = Math.max(...data.viewTrend.map((d) => d.views), 1);
  const trendTotal = data.viewTrend.reduce((s, d) => s + d.views, 0);

  return (
    <>
      <ViewHeader
        title="Article Analytics"
        subtitle="Performance, engagement, and revenue for a single publication."
        actions={
          <Link
            href="/analytics"
            className="rounded-lg border border-line bg-bg-secondary px-3 py-1.5 text-xs font-semibold text-text-muted hover:border-line-hover hover:text-text-main"
          >
            ← Analytics Hub
          </Link>
        }
      />

      {/* Article header */}
      <div className="mb-6 rounded-xl border border-line bg-bg-secondary p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-text-muted">
          <span className="rounded bg-primary-glow px-2 py-0.5 text-primary uppercase">{data.category}</span>
          <span className="rounded bg-bg-tertiary px-2 py-0.5">{data.type}</span>
          <span className="rounded bg-bg-tertiary px-2 py-0.5 capitalize">{data.status}</span>
          {data.lane !== "public" && <span className="rounded bg-bg-tertiary px-2 py-0.5 capitalize">{data.lane}</span>}
        </div>
        <Link href={`/article?id=${data.id}`} className="font-heading text-xl font-bold text-text-main hover:text-primary">
          {data.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-text-muted">
          <span className="inline-flex items-center gap-1">
            By {data.author} {data.authorVerified && <VerifiedBadge size="xs" />}
          </span>
          <span>· {data.readTimeMin} min read</span>
          {data.publishedAt && <span>· published {new Date(data.publishedAt).toLocaleDateString()}</span>}
          {data.owner && <span>· owned by {data.owner}</span>}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="mb-6 grid grid-cols-4 gap-4 max-[768px]:grid-cols-2 max-[480px]:grid-cols-1">
        <StatChip icon={<BarChartIcon className="size-4" />} value={data.views.toLocaleString()} label="Views" />
        <StatChip icon={<HeartIcon className="size-4" />} value={data.likes.toLocaleString()} label="Likes" />
        <StatChip icon={<BookmarkIcon className="size-4" />} value={data.bookmarks.toLocaleString()} label="Bookmarks" />
        <StatChip icon={<DollarSignIcon className="size-4" />} value={formatAUD(data.totalRevenue)} label="Revenue" accent />
      </div>

      <div className="grid grid-cols-2 gap-6 max-[992px]:grid-cols-1">
        {/* Engagement */}
        <div className={dashCard}>
          <h3 className={dashHeading}>
            <HeartIcon className="size-[18px] text-primary" /> Engagement
          </h3>
          <div className="flex flex-col gap-3 text-[13px]">
            <Row label="Views" value={data.views.toLocaleString()} />
            <Row label="Likes" value={data.likes.toLocaleString()} />
            <Row label="Comments" value={data.comments.toLocaleString()} />
            <Row label="Bookmarks" value={data.bookmarks.toLocaleString()} />
            <div className="mt-1 flex items-center justify-between border-t border-line pt-3">
              <span className="font-semibold text-text-main">Engagement rate</span>
              <span className="font-bold text-primary">{data.engagementRate}%</span>
            </div>
            <p className="text-[11px] text-text-muted">
              (likes + comments + bookmarks) ÷ views
            </p>
          </div>
        </div>

        {/* Revenue by type */}
        <div className={dashCard}>
          <h3 className={dashHeading}>
            <DollarSignIcon className="size-[18px] text-primary" /> Revenue breakdown
          </h3>
          {data.revenueByType.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-text-muted">No revenue recorded for this article yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.revenueByType.map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{r.label}</span>
                    <strong className="text-success">{formatAUD(r.value)}</strong>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-[3px] bg-bg-tertiary">
                    <div className="h-full bg-primary" style={{ width: `${Math.round((r.value / maxRevenue) * 100)}%` }} />
                  </div>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-line pt-3 text-[13px] font-semibold">
                <span className="text-text-main">Total</span>
                <span className="text-success">{formatAUD(data.totalRevenue)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Views trend */}
      <div className={cn(dashCard, "mt-6")}>
        <h3 className={dashHeading}>
          <BarChartIcon className="size-[18px] text-primary" /> Views · last 14 days
          <span className="ml-2 text-[12px] font-normal text-text-muted">({trendTotal} tracked)</span>
        </h3>
        <div className="flex h-32 items-end gap-1.5">
          {data.viewTrend.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.views} views`}>
              <div
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${Math.max(2, Math.round((d.views / maxDayViews) * 100))}%` }}
              />
              <span className="text-[8.5px] text-text-muted">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
        {trendTotal === 0 && (
          <p className="mt-3 text-center text-[11.5px] text-text-muted">
            View tracking is live — daily reads will populate this chart from now on.
          </p>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold text-text-main">{value}</span>
    </div>
  );
}
