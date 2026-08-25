import Link from "next/link";

import { auth } from "@/auth";
import { dashCard, dashHeading, EmptyState, StatChip } from "@/components/ui/DashboardKit";
import { ActivityIcon, BookIcon, BookmarkIcon, UsersGroupIcon } from "@/components/ui/icons";
import { LocalTime } from "@/components/ui/LocalTime";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { getReaderSpace } from "@/lib/dashboard";
import { cn } from "@/lib/cn";
import { RemoveBookmarkButton, UnfollowButton } from "./RowActions";

const NOTIFICATION_DOT: Record<string, string> = { publish: "bg-primary", system: "bg-accent" };

export default async function ReaderDashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? "Reader";
  const { saved, followed, notifications } = await getReaderSpace(session!.user.id);

  return (
    <>
      <ViewHeader title={`Welcome back, ${name}`} subtitle="Your personalized feed, bookmarks, and notifications." />

      <div className="mb-7 grid grid-cols-3 gap-4 max-[560px]:grid-cols-1">
        <StatChip icon={<BookmarkIcon className="size-4" />} value={saved.length} label="Saved" />
        <StatChip icon={<UsersGroupIcon className="size-4" />} value={followed.length} label="Following" />
        <StatChip icon={<ActivityIcon className="size-4" />} value={notifications.length} label="Updates" />
      </div>

      <div className="grid grid-cols-[1.35fr_0.65fr] gap-7 max-[992px]:grid-cols-1">
        <div className="flex flex-col gap-7">
          {/* Bookmarks */}
          <div className={dashCard}>
            <h3 className={dashHeading}>
              <BookmarkIcon className="size-[18px] text-primary" /> Saved Articles &amp; Bookmarks
            </h3>
            <div className="flex flex-col gap-3">
              {saved.length === 0 ? (
                <EmptyState
                  text="You haven't saved any articles yet."
                  cta={
                    <Link href="/explore" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">
                      <BookIcon className="size-3.5" /> Browse the feed
                    </Link>
                  }
                />
              ) : (
                saved.map((article) => (
                  <div key={article.id} className="group flex w-full items-center justify-between gap-4 rounded-lg border border-line bg-bg-primary px-4 py-3 transition-all duration-200 hover:border-primary hover:shadow-card max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-3">
                    <Link href={`/article?id=${article.id}`} className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="inline-flex w-fit rounded bg-primary-glow px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">{article.category}</span>
                      <span className="truncate text-sm font-semibold text-text-main transition-colors group-hover:text-primary">{article.title}</span>
                      <span className="text-[11px] text-text-muted">By {article.author}</span>
                    </Link>
                    <RemoveBookmarkButton articleId={article.id} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Followed authors */}
          <div className={dashCard}>
            <h3 className={dashHeading}>
              <UsersGroupIcon className="size-[18px] text-primary" /> Followed Vetted Authors
            </h3>
            <div className="flex flex-col gap-3">
              {followed.length === 0 ? (
                <EmptyState text="You're not following any authors yet." />
              ) : (
                followed.map((author) => (
                  <div key={author.id} className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-bg-primary px-4 py-3 transition-colors hover:border-line-hover">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2da4df_0%,#0056b3_100%)] text-sm font-bold text-white">{author.name.charAt(0)}</div>
                      <div className="min-w-0">
                        <span className="flex items-center gap-1 truncate text-[13.5px] font-semibold text-text-main">
                          {author.name}
                          {author.verified && <VerifiedBadge size="xs" />}
                        </span>
                        <span className="text-[10px] font-medium text-text-muted">
                          {author.verified ? "Verified author" : "Contributor"}
                        </span>
                      </div>
                    </div>
                    <UnfollowButton authorId={author.id} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className={cn(dashCard, "self-start")}>
          <h3 className={dashHeading}>
            <ActivityIcon className="size-[18px] text-primary" /> Activity
          </h3>
          <div className="flex max-h-[440px] flex-col gap-2.5 overflow-y-auto">
            {notifications.length === 0 ? (
              <EmptyState text="No new activity." />
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="flex gap-3 rounded-lg border border-line bg-bg-primary px-3.5 py-3">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", NOTIFICATION_DOT[n.type] ?? "bg-accent")} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] leading-snug text-text-main">{n.text}</p>
                    <span className="mt-1 block text-[10px] text-text-muted"><LocalTime iso={n.createdAt} /></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
