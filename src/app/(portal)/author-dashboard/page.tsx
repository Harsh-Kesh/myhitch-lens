"use client";

import { useRouter } from "next/navigation";

import { articlesGrid } from "@/components/ui/ArticleCard";
import { Button } from "@/components/ui/Button";
import { workspacePanel } from "@/components/ui/Form";
import { CheckIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { useLensValue } from "@/hooks/useLensValue";
import { getArticles } from "@/lib/lensStore";
import { cn } from "@/lib/cn";
import { defaultArticles } from "@/data/defaults";

const PORTFOLIO_AUTHOR = "Dr. Sarah Chen";

const EARNINGS_ROWS = [
  { label: "Subscription payouts", value: "+$1,842.10" },
  { label: "Programmatic Ad share", value: "+$182.40" },
  { label: "Micro-donation payouts", value: "+$116.00" },
];

export default function AuthorDashboardPage() {
  const router = useRouter();
  const articles = useLensValue(getArticles, defaultArticles);

  const portfolio = articles.filter((article) => article.author === PORTFOLIO_AUTHOR);

  return (
    <>
      <ViewHeader
        title="Author Portfolio Studio"
        subtitle="Manage credentials, review subscriber earnings, and monitor published assets."
      />

      {/* Profile header card - `.user-profile-widget` */}
      <div className="mb-[30px] flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-bg-primary p-5 max-[768px]:items-start max-[480px]:p-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-[50px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary-color)_0%,var(--accent-color)_100%)] text-xl font-bold text-white">
            S
          </div>
          <div>
            <h3 className="font-heading text-lg leading-[1.25] font-bold text-text-main max-[480px]:text-base">
              {PORTFOLIO_AUTHOR}{" "}
              <span className="inline-flex items-center gap-0.5 text-xs text-success">
                <CheckIcon className="size-3 align-middle" strokeWidth={3} /> Verified
                Vetted Author
              </span>
            </h3>
            <p className="text-xs text-text-muted">
              Contributor Rank:{" "}
              <span className="font-bold text-success">#42 (Gold tier status)</span> •
              Expertise: Supply Chain Operations, AI Logistics
            </p>
          </div>
        </div>
        <div>
          <span className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-bold text-white">
            Premium Contributor Account
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[1.3fr_0.7fr] gap-[30px] max-[992px]:grid-cols-1">
        {/* Portfolio feed */}
        <div className={workspacePanel}>
          <h3 className="mb-4 font-heading text-base leading-[1.25] font-bold text-text-main">
            My Publications Portfolio
          </h3>
          <div className={articlesGrid}>
            {portfolio.length === 0 ? (
              <p className="w-full p-5 text-center text-[13px] text-text-muted">
                You have not published any articles yet.
              </p>
            ) : (
              portfolio.map((article) => (
                <div
                  key={article.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/article?id=${article.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/article?id=${article.id}`);
                    }
                  }}
                  className="flex cursor-pointer flex-col rounded-xl border border-line bg-bg-secondary p-6 transition-all duration-300 hover:-translate-y-1 hover:border-line-hover hover:shadow-card max-[480px]:p-5"
                >
                  <div className="mb-3 flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-primary uppercase">{article.category}</span>
                    <span className="rounded bg-bg-tertiary px-2 py-0.5 text-text-muted">
                      {article.type}
                    </span>
                  </div>
                  <h3 className="mb-3 font-heading text-lg leading-[1.35] font-bold text-text-main">
                    {article.title}
                  </h3>
                  <p className="mb-5 line-clamp-3 flex-1 text-[13px] text-text-muted">
                    {article.summary}
                  </p>
                  <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-text-muted">
                    <span>
                      Views: <strong>{article.likes * 12}</strong>
                    </span>
                    <span>
                      Earnings:{" "}
                      <strong className="text-success">
                        +${(article.likes * 2.5).toFixed(2)}
                      </strong>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Earnings sidebar card */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-line bg-bg-secondary p-6">
            <h4 className="mb-4 font-heading text-sm leading-[1.25] font-bold text-text-muted uppercase">
              Monetization Intake
            </h4>
            <div className="mt-2.5 flex flex-col gap-4">
              <div>
                <span className="text-[11px] text-text-muted uppercase">
                  Accumulated Earnings
                </span>
                <span className="block text-lg font-extrabold text-success">
                  $2,140.50
                </span>
              </div>
              {EARNINGS_ROWS.map((row, index) => (
                <div
                  key={row.label}
                  className={cn(
                    "flex justify-between text-[13px]",
                    index === 0 && "border-t border-line pt-2.5",
                  )}
                >
                  <span>{row.label}</span>
                  <span className="text-success">{row.value}</span>
                </div>
              ))}
              <Button
                size="sm"
                className="mt-2.5 w-full"
                onClick={() =>
                  alert(
                    "Proceeding to Ethereum wallet payout verification... (Simulated)",
                  )
                }
              >
                Payout Funds
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
