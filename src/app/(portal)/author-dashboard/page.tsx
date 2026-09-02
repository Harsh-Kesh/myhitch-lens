import Link from "next/link";

import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading, EmptyState, StatChip } from "@/components/ui/DashboardKit";
import { BarChartIcon, BookIcon, ClockIcon, DollarSignIcon, HeartIcon, PencilIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { getAuthorSpace } from "@/lib/dashboard";
import { getMyVerification } from "@/lib/verification";
import { cn } from "@/lib/cn";
import { MARKETPLACE_DEFAULTS } from "@/lib/platformConfig";
import { VerificationStatus } from "./VerificationPanel";
import { RemovedArticles } from "./RemovedArticles";
import { DeleteDraftButton } from "./DeleteDraftButton";

function formatAUD(n: number): string {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tierLabel(tier: string | null): string {
  if (!tier) return "Unranked";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export default async function AuthorDashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? "Author";
  const space = await getAuthorSpace(session!.user.id);
  const verification = await getMyVerification(session!.user.id);
  const { articles, drafts, pendingReview, removedArticles, copyrightStrikes, totalViews, totalLikes, published, totalEarnings, earningsBreakdown, walletBalance, rankPosition, rankTier, rankPoints } = space;

  return (
    <>
      <ViewHeader title="Author Studio" subtitle="Manage your profile, monitor published work, and review earnings." />

      {/* Profile header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-bg-secondary p-5 max-[480px]:p-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2da4df_0%,#0056b3_100%)] text-lg font-bold text-white">{name.charAt(0)}</div>
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 font-heading text-lg font-bold text-text-main max-[480px]:text-base">
              {name}
              <VerificationStatus state={verification.state} reviewerNote={verification.reviewerNote} />
            </h3>
            <p className="mt-0.5 text-xs text-text-muted">
              {rankPosition != null ? (
                <>Rank <span className="font-semibold text-text-main">#{rankPosition} · {tierLabel(rankTier)} tier</span> · {rankPoints.toLocaleString()} pts</>
              ) : (
                <span className="text-text-muted">No rank yet — publish to earn points</span>
              )}
            </p>
          </div>
        </div>
        {rankTier === "gold" && (
          <span className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-white">Premium Contributor</span>
        )}
      </div>

      {/* Quick stats */}
      <div className="mb-6 grid grid-cols-4 gap-4 max-[768px]:grid-cols-2 max-[480px]:grid-cols-1">
        <StatChip icon={<BookIcon className="size-4" />} value={published} label="Published" />
        <StatChip icon={<BarChartIcon className="size-4" />} value={totalViews.toLocaleString()} label="Total views" />
        <StatChip icon={<HeartIcon className="size-4" />} value={totalLikes.toLocaleString()} label="Total likes" />
        <StatChip icon={<DollarSignIcon className="size-4" />} value={formatAUD(totalEarnings)} label="Earnings" accent />
      </div>

      {/* Drafts + New article */}
      {(drafts.length > 0) && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className={dashHeading}>
              <PencilIcon className="size-[18px] text-primary" /> Drafts
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className={cn(
                  "flex items-center gap-1 rounded-lg border pr-2 pl-4 transition-all hover:shadow-card",
                  draft.status === "changes_requested"
                    ? "border-warning/40 bg-warning/5 hover:border-warning"
                    : "border-line bg-bg-secondary hover:border-primary",
                )}
              >
                <Link href={`/submit?draft=${draft.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
                  {draft.status === "changes_requested" ? (
                    <svg className="size-4 shrink-0 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  ) : (
                    <PencilIcon className="size-4 shrink-0 text-text-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-main">{draft.title}</p>
                    <p className={cn("text-[11px]", draft.status === "changes_requested" ? "font-semibold text-warning" : "text-text-muted")}>
                      {draft.status === "changes_requested" ? "Revision requested — click to edit" : "Draft"} · {new Date(draft.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
                <DeleteDraftButton draftId={draft.id} title={draft.title} />
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingReview.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className={dashHeading}>
              <ClockIcon className="size-[18px] text-primary" /> Pending Review
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {pendingReview.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-bg-secondary px-4 py-3"
              >
                <ClockIcon className="size-4 shrink-0 text-text-muted" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-main">{item.title}</p>
                  <p className="text-[11px] text-text-muted">
                    Submitted {new Date(item.submittedAt).toLocaleDateString()} · Awaiting editorial review
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RemovedArticles items={removedArticles} strikes={copyrightStrikes} />

      <div className="grid grid-cols-[1.35fr_0.65fr] gap-7 max-[992px]:grid-cols-1">
        {/* Portfolio */}
        <div className={dashCard}>
          <h3 className={dashHeading}>
            <BookIcon className="size-[18px] text-primary" /> My Publications
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4">
            {articles.length === 0 ? (
              <div className="col-[1/-1]">
                <EmptyState
                  text="You haven't published any articles yet."
                  cta={<Link href="/submit" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">Write your first article</Link>}
                />
              </div>
            ) : (
              articles.map((article) => (
                <div key={article.id} className="group flex flex-col rounded-xl border border-line bg-bg-primary p-5 transition-all duration-200 hover:border-primary hover:shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded bg-primary-glow px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">{article.category}</span>
                    <span className="text-[11px] text-text-muted">{article.type}</span>
                  </div>
                  <Link href={`/article?id=${article.id}`} className="mb-2 font-heading text-[15px] leading-snug font-bold text-text-main transition-colors hover:text-primary">{article.title}</Link>
                  <p className="mb-4 line-clamp-2 flex-1 text-[12.5px] text-text-muted">{article.summary}</p>
                  <div className="flex items-center justify-between border-t border-line pt-3 text-[11.5px] text-text-muted">
                    <span>{article.views.toLocaleString()} views</span>
                    {article.earnings > 0 && (
                      <span className="font-semibold text-success">+{formatAUD(article.earnings)}</span>
                    )}
                  </div>
                  <Link href={`/analytics/article?id=${article.id}`} className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline">
                    <BarChartIcon className="size-3.5" /> View analytics
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Monetization */}
        <div className={cn(dashCard, "self-start")}>
          <h3 className={dashHeading}>
            <DollarSignIcon className="size-[18px] text-primary" /> Monetization
          </h3>
          <div className="rounded-lg border border-line bg-bg-primary p-4">
            <span className="text-[11px] font-medium text-text-muted uppercase">Available balance</span>
            <span className="mt-1 block font-heading text-2xl font-extrabold text-success">{formatAUD(walletBalance)}</span>
          </div>
          {earningsBreakdown.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3">
              {earningsBreakdown.map((row) => (
                <div key={row.label} className="flex justify-between text-[13px]">
                  <span className="text-text-muted">{row.label}</span>
                  <span className="font-medium text-success">+{formatAUD(row.value)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-3 text-[13px] font-semibold">
                <span className="text-text-main">Total earned</span>
                <span className="text-success">{formatAUD(totalEarnings)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-center text-[12px] text-text-muted">No earnings yet — revenue appears as readers engage with your content.</p>
          )}
          <Button size="sm" className="mt-5 w-full" disabled={walletBalance < MARKETPLACE_DEFAULTS.payoutMinimum}>
            Withdraw Funds
          </Button>
          <p className="mt-2 text-center text-[10.5px] text-text-muted">
            Minimum payout A${MARKETPLACE_DEFAULTS.payoutMinimum} · paid via Stripe
          </p>
        </div>
      </div>
    </>
  );
}
