"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import {
  ActivityIcon,
  BookIcon,
  BookmarkIcon,
  CheckIcon,
  UsersGroupIcon,
} from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { useLensValue } from "@/hooks/useLensValue";
import {
  getArticles,
  getBookmarks,
  getFollowed,
  getNotifications,
  getUserName,
  saveBookmarks,
  saveFollowed,
} from "@/lib/lensStore";
import { cn } from "@/lib/cn";
import {
  defaultArticles,
  defaultBookmarks,
  defaultFollowed,
  defaultNotifications,
} from "@/data/defaults";
import type { Notification } from "@/lib/types";

const editorGrid = "grid grid-cols-[1.35fr_0.65fr] gap-7 max-[992px]:grid-cols-1";

const cardBase = "rounded-xl border border-line bg-bg-secondary p-6 max-[480px]:p-5";

const panelHeading =
  "mb-4 flex items-center gap-2 font-heading text-[15px] font-bold text-text-main";

/** Compact metric shown in the greeting row. */
function StatChip({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-secondary px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-glow text-primary">
        {icon}
      </span>
      <div className="leading-tight">
        <span className="block font-heading text-lg font-bold text-text-main">{value}</span>
        <span className="text-[11px] font-medium text-text-muted uppercase">{label}</span>
      </div>
    </div>
  );
}

/** Friendly placeholder when a list is empty. */
function EmptyState({ text, cta }: { text: string; cta?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-bg-primary px-4 py-8 text-center">
      <p className="text-[13px] text-text-muted">{text}</p>
      {cta}
    </div>
  );
}

const NOTIFICATION_STYLES: Record<Notification["type"], { dot: string; label: string }> = {
  publish: { dot: "bg-primary", label: "Publishing" },
  system: { dot: "bg-accent", label: "System" },
};

export default function ReaderDashboardPage() {
  const articles = useLensValue(getArticles, defaultArticles);
  const bookmarks = useLensValue(getBookmarks, defaultBookmarks);
  const followed = useLensValue(getFollowed, defaultFollowed);
  const notifications = useLensValue(getNotifications, defaultNotifications);
  const name = useLensValue(getUserName, "Reader");

  function removeBookmark(id: string) {
    saveBookmarks(getBookmarks().filter((bookmark) => bookmark !== id));
  }

  function unfollowAuthor(name: string) {
    saveFollowed(getFollowed().filter((author) => author !== name));
  }

  const saved = articles.filter((article) => bookmarks.includes(article.id));
  const firstName = name.split(" ")[0];

  return (
    <>
      <ViewHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Your personalized feed, bookmarks, and notifications."
      />

      {/* Quick stats */}
      <div className="mb-7 grid grid-cols-3 gap-4 max-[560px]:grid-cols-1">
        <StatChip icon={<BookmarkIcon className="size-4" />} value={saved.length} label="Saved" />
        <StatChip icon={<UsersGroupIcon className="size-4" />} value={followed.length} label="Following" />
        <StatChip icon={<ActivityIcon className="size-4" />} value={notifications.length} label="Updates" />
      </div>

      <div className={editorGrid}>
        <div className="flex flex-col gap-7">
          {/* Bookmarks */}
          <div className={cardBase}>
            <h3 className={panelHeading}>
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
                  <div
                    key={article.id}
                    className="group flex w-full items-center justify-between gap-4 rounded-lg border border-line bg-bg-primary px-4 py-3 transition-all duration-200 hover:border-primary hover:shadow-card max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-3"
                  >
                    <Link href={`/article?id=${article.id}`} className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="inline-flex w-fit rounded bg-primary-glow px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                        {article.category}
                      </span>
                      <span className="truncate text-sm font-semibold text-text-main transition-colors group-hover:text-primary">
                        {article.title}
                      </span>
                      <span className="text-[11px] text-text-muted">By {article.author}</span>
                    </Link>
                    <Button variant="secondary" size="sm" onClick={() => removeBookmark(article.id)}>
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Followed Authors */}
          <div className={cardBase}>
            <h3 className={panelHeading}>
              <UsersGroupIcon className="size-[18px] text-primary" /> Followed Vetted Authors
            </h3>
            <div className="flex flex-col gap-3">
              {followed.length === 0 ? (
                <EmptyState text="You're not following any authors yet." />
              ) : (
                followed.map((author) => (
                  <div
                    key={author}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-bg-primary px-4 py-3 transition-colors hover:border-line-hover"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2da4df_0%,#0056b3_100%)] text-sm font-bold text-white">
                        {author.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold text-text-main">
                          {author}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
                          <CheckIcon className="size-2.5" strokeWidth={3} /> Verified Contributor
                        </span>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => unfollowAuthor(author)}>
                      Unfollow
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className={cn(cardBase, "self-start")}>
          <h3 className={panelHeading}>
            <ActivityIcon className="size-[18px] text-primary" /> Activity
          </h3>
          <div className="flex max-h-[440px] flex-col gap-2.5 overflow-y-auto">
            {notifications.length === 0 ? (
              <EmptyState text="No new activity." />
            ) : (
              notifications.map((notification) => {
                const style = NOTIFICATION_STYLES[notification.type] ?? NOTIFICATION_STYLES.system;
                return (
                  <div
                    key={notification.id}
                    className="flex gap-3 rounded-lg border border-line bg-bg-primary px-3.5 py-3"
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", style.dot)} />
                    <div className="min-w-0">
                      <p className="text-[12.5px] leading-snug text-text-main">{notification.text}</p>
                      <span className="mt-1 block text-[10px] text-text-muted">{notification.date}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
