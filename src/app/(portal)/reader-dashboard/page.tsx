"use client";

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { workspacePanel } from "@/components/ui/Form";
import { CheckIcon, UsersGroupIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { useLensValue } from "@/hooks/useLensValue";
import {
  getArticles,
  getBookmarks,
  getFollowed,
  getNotifications,
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

/** `.editor-grid` */
const editorGrid = "grid grid-cols-[1.3fr_0.7fr] gap-[30px] max-[992px]:grid-cols-1";

/** Section heading shared by both left-column panels. */
const panelHeading =
  "mb-3 border-b border-line pb-1.5 font-heading text-base font-bold text-text-main";

export default function ReaderDashboardPage() {
  const articles = useLensValue(getArticles, defaultArticles);
  const bookmarks = useLensValue(getBookmarks, defaultBookmarks);
  const followed = useLensValue(getFollowed, defaultFollowed);
  const notifications = useLensValue(getNotifications, defaultNotifications);

  function removeBookmark(id: string) {
    saveBookmarks(getBookmarks().filter((bookmark) => bookmark !== id));
  }

  function unfollowAuthor(name: string) {
    saveFollowed(getFollowed().filter((author) => author !== name));
  }

  const saved = articles.filter((article) => bookmarks.includes(article.id));

  return (
    <>
      <ViewHeader
        title="Reader Space"
        subtitle="Your personalized feed, bookmarks, and notifications."
      />

      <div className={editorGrid}>
        <div className={cn(workspacePanel, "flex flex-col gap-6")}>
          {/* Bookmarks */}
          <div>
            <h3 className={panelHeading}>Saved Articles &amp; Bookmarks</h3>
            <div className="flex flex-col gap-3">
              {saved.length === 0 ? (
                <p className="p-2.5 text-[12.5px] text-text-muted">
                  You have no saved bookmarks.
                </p>
              ) : (
                saved.map((article) => (
                  /* `.bookmark-row` */
                  <div
                    key={article.id}
                    className="flex w-full items-center justify-between gap-4 rounded-lg border border-line bg-bg-primary px-4 py-3 max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-3"
                  >
                    <Link
                      href={`/article?id=${article.id}`}
                      className="flex cursor-pointer flex-col gap-1"
                    >
                      <span className="text-sm font-semibold">{article.title}</span>
                      <span className="text-[11px] text-text-muted">
                        {article.category} • By {article.author}
                      </span>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => removeBookmark(article.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Followed Authors */}
          <div>
            <h3 className={cn(panelHeading, "flex items-center gap-1.5")}>
              <UsersGroupIcon className="size-4 align-middle text-primary" /> Followed
              Vetted Authors
            </h3>
            <div className="flex flex-col gap-3">
              {followed.length === 0 ? (
                <p className="p-2.5 text-[12.5px] text-text-muted">
                  You do not follow any authors yet.
                </p>
              ) : (
                followed.map((author) => (
                  /* `.author-row` */
                  <div
                    key={author}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-bg-primary px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex size-6 items-center justify-center rounded-full bg-primary-glow text-[11px] font-bold text-primary">
                        {author.charAt(0)}
                      </div>
                      <div>
                        <span className="block text-[13.5px] font-semibold">
                          {author}
                        </span>
                        <span className="block text-[9px] text-success">
                          <CheckIcon
                            className="mr-0.5 inline size-2.5 align-middle"
                            strokeWidth={3}
                          />
                          Verified Contributor
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => unfollowAuthor(author)}
                    >
                      Unfollow
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Notifications log */}
        <div className="flex flex-col gap-6">
          {/* `.stats-panel` */}
          <div className="rounded-xl border border-line bg-bg-secondary p-6">
            <h4 className="mb-4 font-heading text-sm leading-[1.25] font-bold text-text-muted uppercase">
              Activity Notifications
            </h4>
            <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
              {notifications.map((notification) => (
                /* `.notification-item` */
                <div
                  key={notification.id}
                  className="flex flex-col gap-1 rounded-lg border border-line border-l-[3px] border-l-accent bg-bg-secondary px-4 py-3 text-[12.5px]"
                >
                  <span>{notification.text}</span>
                  <span className="text-[10px] text-text-muted">
                    {notification.date}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
