import Link from "next/link";

import { workspacePanel } from "@/components/ui/Form";
import { HeartIcon, UsersIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import type { PlatformAnalyticsData } from "@/lib/dashboard";
import { cn } from "@/lib/cn";
import { formatAUD, formatCompact, TABLE_CELL } from "./format";

export function PlatformAnalyticsView({ data }: { data: PlatformAnalyticsData }) {
  const { totalViews, totalArticles, totalAuthors, totalEarnings, topArticles, topAuthors, categoryShares } = data;

  const kpis = [
    { label: "Active Authors", value: formatCompact(totalAuthors) },
    { label: "Published Articles", value: formatCompact(totalArticles) },
    { label: "Platform Views", value: formatCompact(totalViews) },
    { label: "Revenue Distributed", value: formatAUD(totalEarnings), positive: true },
  ];

  return (
    <>
      <ViewHeader
        title="Analytics Hub"
        subtitle="A rough, platform-wide view across every author and published article — not just your own."
      />

      {/* KPI widgets */}
      <div className="mb-[30px] grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-line bg-bg-secondary p-6 max-[480px]:p-4">
            <span className="text-[11px] text-text-muted uppercase">{kpi.label}</span>
            <span className={cn("block text-lg font-extrabold", kpi.positive && "text-success")}>{kpi.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.3fr_0.7fr] gap-[30px] max-[992px]:grid-cols-1">
        {/* Top authors */}
        <div className={workspacePanel}>
          <h3 className="mb-3 flex items-center gap-2 font-heading text-[15px] font-bold text-text-main">
            <UsersIcon className="size-[18px] align-middle text-primary" /> Top Authors by Views
          </h3>
          {topAuthors.length > 0 ? (
            <div className="flex flex-col gap-3">
              {topAuthors.map((author) => {
                const maxViews = Math.max(...topAuthors.map((a) => a.views), 1);
                const pct = Math.round((author.views / maxViews) * 100);
                return (
                  <div key={author.id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="truncate pr-2">
                        {author.name} <span className="text-text-muted">· {author.articles} article(s)</span>
                      </span>
                      <strong className="shrink-0">{author.views.toLocaleString()} views</strong>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-[3px] bg-bg-tertiary">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-text-muted">No published articles yet.</p>
          )}
        </div>

        {/* Category performance */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-line bg-bg-secondary p-6 max-[480px]:p-5">
            <h4 className="mb-4 font-heading text-sm leading-[1.25] font-bold text-text-muted uppercase">
              Top Categories Share
            </h4>
            {categoryShares.length > 0 ? (
              <div className="mt-4 flex flex-col gap-3">
                {categoryShares.map((category) => (
                  <div key={category.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{category.label}</span>
                      <strong>{category.percent}%</strong>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-[3px] bg-bg-tertiary">
                      <div className="h-full bg-primary" style={{ width: `${category.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-text-muted">No published articles yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Top articles table */}
      <div className={cn(workspacePanel, "mt-[30px] w-full")}>
        <h3 className="mb-3 font-heading text-[15px] font-bold text-text-main">
          Top Performing Articles Platform-Wide
        </h3>
        {totalArticles > topArticles.length && (
          <p className="mb-3 text-[11.5px] text-text-muted">
            Showing the top {topArticles.length} of {totalArticles} published articles, by views.
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border border-line bg-bg-secondary">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-bg-tertiary">
                <th className={TABLE_CELL}>Asset Title</th>
                <th className={TABLE_CELL}>Author</th>
                <th className={TABLE_CELL}>Category</th>
                <th className={cn(TABLE_CELL, "text-right")}>Views</th>
                <th className={cn(TABLE_CELL, "text-right")}>Likes</th>
                <th className={cn(TABLE_CELL, "text-right")}>Earnings</th>
              </tr>
            </thead>
            <tbody>
              {topArticles.map((article) => (
                <tr key={article.id} className="border-b border-line">
                  <td className={cn(TABLE_CELL, "font-semibold text-text-main")}>
                    <Link href={`/analytics/article?id=${article.id}`} className="hover:text-primary hover:underline">
                      {article.title}
                    </Link>
                  </td>
                  <td className={cn(TABLE_CELL, "text-text-muted")}>{article.author}</td>
                  <td className={TABLE_CELL}>
                    <span className="rounded-[10px] bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {article.category}
                    </span>
                  </td>
                  <td className={cn(TABLE_CELL, "text-right font-bold")}>{article.views.toLocaleString()}</td>
                  <td className={cn(TABLE_CELL, "text-right")}>
                    <HeartIcon className="mr-1 inline size-3 align-middle text-primary" />
                    {article.likes}
                  </td>
                  <td className={cn(TABLE_CELL, "text-right text-success")}>
                    <strong>{formatAUD(article.earnings)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
