"use client";

import { workspacePanel } from "@/components/ui/Form";
import { BarChartIcon, HeartIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { useLensValue } from "@/hooks/useLensValue";
import { getArticles } from "@/lib/lensStore";
import { cn } from "@/lib/cn";
import { defaultArticles } from "@/data/defaults";

const KPIS = [
  { label: "Accumulated Views", value: "34.8K", change: "▲ +12.4% vs last mo" },
  { label: "Avg. Read Time", value: "4.5 min", change: "▲ +4.2% vs last mo" },
  { label: "Vetted Followers", value: "1.2K", change: "▲ +82 followers" },
  {
    label: "Net Revenue Share",
    value: "$2,140.50",
    change: "▲ +$340.10 this mo",
    positive: true,
  },
];

const CATEGORY_SHARE = [
  { label: "AI Logistics", percent: 45 },
  { label: "Supply Chain", percent: 30 },
  { label: "Finance Modeling", percent: 15 },
  { label: "Travel & SAF", percent: 10 },
];

/** X-axis ticks of the engagement trend chart. */
const TREND_POINTS = [
  { x: 40, y: 150, label: "May" },
  { x: 110, y: 130, label: "Jun 05" },
  { x: 180, y: 145, label: "Jun 15" },
  { x: 250, y: 95, label: "Jul 01" },
  { x: 320, y: 80, label: "Jul 10" },
  { x: 390, y: 65, label: "Jul 15" },
  { x: 480, y: 35, label: "Today" },
];

const TABLE_CELL = "px-4 py-3";

export default function AnalyticsPage() {
  const articles = useLensValue(getArticles, defaultArticles);

  return (
    <>
      <ViewHeader
        title="Analytics Hub"
        subtitle="Monitor reader engagement metrics, publication reads, and ad-revenue trends."
      />

      {/* Dashboard Stats widgets */}
      <div className="mb-[30px] grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-line bg-bg-secondary p-6 max-[480px]:p-4"
          >
            <span className="text-[11px] text-text-muted uppercase">{kpi.label}</span>
            <span
              className={cn(
                "block text-lg font-extrabold",
                kpi.positive && "text-success",
              )}
            >
              {kpi.value}
            </span>
            <span>{kpi.change}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.3fr_0.7fr] gap-[30px] max-[992px]:grid-cols-1">
        {/* Trend Line Chart */}
        <div className={workspacePanel}>
          <h3 className="mb-3 flex items-center gap-2 font-heading text-[15px] font-bold text-text-main">
            <BarChartIcon className="size-[18px] align-middle text-primary" /> Reader
            Views &amp; Engagement Trend
          </h3>
          <div className="rounded-lg border border-line bg-bg-secondary p-5 text-center max-[480px]:p-3">
            {/* Height is left to the viewBox ratio so the plotted points keep
                their spacing instead of squashing on a narrow screen. */}
            <svg
              viewBox="0 0 500 200"
              className="aspect-[5/2] h-auto w-full overflow-visible"
            >
              {/* grid lines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="var(--border-color)" strokeDasharray="4" />
              <line x1="40" y1="70" x2="480" y2="70" stroke="var(--border-color)" strokeDasharray="4" />
              <line x1="40" y1="120" x2="480" y2="120" stroke="var(--border-color)" strokeDasharray="4" />
              <line x1="40" y1="170" x2="480" y2="170" stroke="var(--border-color)" />

              {/* chart path */}
              <path
                d="M 40 150 L 110 130 L 180 145 L 250 95 L 320 80 L 390 65 L 480 35"
                fill="none"
                stroke="var(--primary-color)"
                strokeWidth="3"
              />

              {/* nodes */}
              {TREND_POINTS.map((point, index) => (
                <circle
                  key={point.label}
                  cx={point.x}
                  cy={point.y}
                  r={index === TREND_POINTS.length - 1 ? 5 : 4}
                  fill="var(--primary-color)"
                />
              ))}

              {/* labels */}
              {TREND_POINTS.map((point) => (
                <text
                  key={point.label}
                  x={point.x}
                  y={190}
                  fill="var(--text-muted)"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {point.label}
                </text>
              ))}

              <text x="30" y="150" fill="var(--text-muted)" fontSize="9" textAnchor="end">
                5k
              </text>
              <text x="30" y="95" fill="var(--text-muted)" fontSize="9" textAnchor="end">
                15k
              </text>
              <text x="30" y="35" fill="var(--text-muted)" fontSize="9" textAnchor="end">
                35k
              </text>
            </svg>
          </div>
        </div>

        {/* Category performance bars */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-line bg-bg-secondary p-6 max-[480px]:p-5">
            <h4 className="mb-4 font-heading text-sm leading-[1.25] font-bold text-text-muted uppercase">
              Top Categories Share
            </h4>
            <div className="mt-4 flex flex-col gap-3">
              {CATEGORY_SHARE.map((category) => (
                <div key={category.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{category.label}</span>
                    <strong>{category.percent}%</strong>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-[3px] bg-bg-tertiary">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${category.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top publications table */}
      <div className={cn(workspacePanel, "mt-[30px] w-full")}>
        <h3 className="mb-3 font-heading text-[15px] font-bold text-text-main">
          Top Performing Published Assets
        </h3>
        {/* Six columns cannot compress into a phone width without becoming
            unreadable, so the table keeps its natural size and the wrapper
            scrolls. */}
        <div className="overflow-x-auto rounded-lg border border-line bg-bg-secondary">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-bg-tertiary">
                <th className={TABLE_CELL}>Asset Title</th>
                <th className={TABLE_CELL}>Author</th>
                <th className={TABLE_CELL}>Category</th>
                <th className={cn(TABLE_CELL, "text-right")}>Views</th>
                <th className={cn(TABLE_CELL, "text-right")}>Likes</th>
                <th className={cn(TABLE_CELL, "text-right")}>Est. Share</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-b border-line">
                  <td className={cn(TABLE_CELL, "font-semibold text-text-main")}>
                    {article.title}
                  </td>
                  <td className={cn(TABLE_CELL, "text-text-muted")}>{article.author}</td>
                  <td className={TABLE_CELL}>
                    <span className="rounded-[10px] bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {article.category}
                    </span>
                  </td>
                  <td className={cn(TABLE_CELL, "text-right font-bold")}>
                    {article.likes * 12}
                  </td>
                  <td className={cn(TABLE_CELL, "text-right")}>
                    <HeartIcon className="mr-1 inline size-3 align-middle text-primary" />
                    {article.likes}
                  </td>
                  <td className={cn(TABLE_CELL, "text-right text-success")}>
                    <strong>${(article.likes * 2.5).toFixed(2)}</strong>
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
