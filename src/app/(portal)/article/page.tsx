"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useLensValue } from "@/hooks/useLensValue";

import { Button, buttonClasses } from "@/components/ui/Button";
import { formControl } from "@/components/ui/Form";
import {
  BookmarkIcon,
  BriefcaseIcon,
  HeartIcon,
  SendIcon,
  ShoppingCartIcon,
} from "@/components/ui/icons";
import {
  getArticles,
  getBookmarks,
  getIntegrations,
  getUserName,
  getUserRole,
  saveArticles,
  saveBookmarks,
} from "@/lib/lensStore";
import { cn } from "@/lib/cn";
import {
  defaultArticles,
  defaultBookmarks,
  defaultIntegrations,
} from "@/data/defaults";
import type { Comment } from "@/lib/types";

/** Simulated narration length, matching the original 2m34s placeholder. */
const AUDIO_DURATION_SECONDS = 154;
const AUDIO_TICK_MS = 300;
const AUDIO_STEP_PERCENT = 2;

function formatAudioTime(percent: number): string {
  const seconds = Math.floor((percent / 100) * AUDIO_DURATION_SECONDS);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder < 10 ? "0" : ""}${remainder} / 2:34`;
}

/** `.btn-bookmark` / `.btn-like` */
const actionButton =
  "flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold";

/** `.widget-box` */
const widgetBox =
  "flex items-center justify-between gap-4 rounded-lg border border-line bg-bg-primary p-4 max-[560px]:flex-col max-[560px]:items-stretch max-[560px]:gap-3";

function IntegrationWidget({
  icon,
  title,
  desc,
  action,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  action: ReactNode;
}) {
  return (
    <div className={widgetBox}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex shrink-0 items-center text-xl">{icon}</span>
        <div>
          <h5 className="font-heading text-[13.5px] font-semibold text-text-main">
            {title}
          </h5>
          <p className="text-[11.5px] text-text-muted">{desc}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function ArticleDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const articles = useLensValue(getArticles, defaultArticles);
  const bookmarks = useLensValue(getBookmarks, defaultBookmarks);
  const integrations = useLensValue(getIntegrations, defaultIntegrations);

  const article = articles.find((item) => item.id === id) ?? null;
  const bookmarked = article ? bookmarks.includes(article.id) : false;

  const [draftComment, setDraftComment] = useState("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioPercent, setAudioPercent] = useState(0);
  const audioTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAudio = useCallback(() => {
    if (audioTimer.current) clearInterval(audioTimer.current);
    audioTimer.current = null;
  }, []);

  useEffect(() => stopAudio, [stopAudio]);

  function toggleAudio() {
    if (audioPlaying) {
      stopAudio();
      setAudioPlaying(false);
      return;
    }

    setAudioPlaying(true);
    audioTimer.current = setInterval(() => {
      setAudioPercent((current) => {
        const next = current + AUDIO_STEP_PERCENT;
        if (next >= 100) {
          stopAudio();
          setAudioPlaying(false);
          return 0;
        }
        return next;
      });
    }, AUDIO_TICK_MS);
  }

  function toggleBookmark() {
    if (!article) return;
    const list = getBookmarks();
    saveBookmarks(
      list.includes(article.id)
        ? list.filter((entry) => entry !== article.id)
        : [...list, article.id],
    );
  }

  function toggleLike() {
    if (!article) return;
    const liked = !article.liked;
    saveArticles(
      getArticles().map((item) =>
        item.id === article.id
          ? { ...item, liked, likes: item.likes + (liked ? 1 : -1) }
          : item,
      ),
    );
  }

  function postComment() {
    if (!article) return;
    const text = draftComment.trim();
    if (!text) return;

    const comment: Comment = {
      name: `${getUserName()} (${getUserRole().toUpperCase()})`,
      date: "Just now",
      text,
    };

    saveArticles(
      getArticles().map((item) =>
        item.id === article.id
          ? { ...item, comments: [...item.comments, comment] }
          : item,
      ),
    );
    setDraftComment("");
  }

  if (!article) {
    return (
      <>
        <BackButton onClick={() => router.back()} />
        <div className="min-h-[400px] rounded-xl border border-line bg-bg-secondary p-8 max-[640px]:p-5">
          <div className="p-10 text-center text-text-muted">
            <p>Publication not found. It may have been archived or retracted.</p>
          </div>
        </div>
      </>
    );
  }

  const widgets: ReactNode[] = [];
  if (integrations.services) {
    widgets.push(
      <IntegrationWidget
        key="services"
        icon={<BriefcaseIcon className="size-5 text-primary" />}
        title={`Connect with ${article.author}`}
        desc={`Request consulting on topics involving ${article.category} and related operations.`}
        action={
          <Button
            size="sm"
            onClick={() =>
              alert(
                `Routing to scheduling calendar for ${article.author}... (Simulated)`,
              )
            }
          >
            Book Consultation
          </Button>
        }
      />,
    );
  }
  if (
    integrations.mart &&
    ["Supply Chain", "AI", "Technology"].includes(article.category)
  ) {
    widgets.push(
      <IntegrationWidget
        key="mart"
        icon={<ShoppingCartIcon className="size-5 text-primary" />}
        title="Recommended Procurement Products"
        desc="Mentioned Hardware, Telemetry Sensors, and Cloud API listings on MYHitch Mart."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              alert("Displaying 3 verified hardware modules found in text (Sandbox)...")
            }
          >
            Open Mart Links
          </Button>
        }
      />,
    );
  }
  if (integrations.travel && article.category === "Travel") {
    widgets.push(
      <IntegrationWidget
        key="travel"
        icon={<SendIcon className="size-5 text-primary" />}
        title="JetNRest SAF Travel Search"
        desc="Search carbon-offset airline bookings directly to author's research hubs."
        action={
          <Button
            size="sm"
            onClick={() => alert("Launching flight lookup modal (Simulated SAF paths)...")}
          >
            Compare SAF Flights
          </Button>
        }
      />,
    );
  }
  if (integrations.donations) {
    widgets.push(
      <IntegrationWidget
        key="donations"
        icon={<HeartIcon className="size-5 text-primary" />}
        title={`Support ${article.author}'s Research`}
        desc="Send micro-grants directly via securely connected wallets."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => alert("Connecting web3 wallet gateway... (Simulated)")}
          >
            Send Micro-grant
          </Button>
        }
      />,
    );
  }

  return (
    <>
      <BackButton onClick={() => router.back()} />

      <div className="min-h-[400px] rounded-xl border border-line bg-bg-secondary p-8 max-[640px]:p-5">
        <div className="mb-6">
          <span className="text-[11px] font-bold tracking-[0.5px] text-primary uppercase">
            {article.category}
          </span>
        </div>

        <h2 className="mb-4 font-heading text-[28px] leading-[1.3] font-bold text-text-main max-[640px]:text-[23px] max-[480px]:text-[20px]">
          {article.title}
        </h2>

        {/* `.modal-author-bar` */}
        <div className="mb-6 flex flex-wrap items-center gap-y-3 rounded-lg border border-line bg-bg-primary px-[18px] py-3 max-[480px]:px-4">
          <div className="mr-3 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-text-inverse">
            {article.author.charAt(0)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13.5px] font-semibold">{article.author}</span>
            <span className="text-[11px] text-text-muted">{article.authorRank}</span>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              aria-label="Toggle bookmark"
              aria-pressed={bookmarked}
              onClick={toggleBookmark}
              className={cn(
                actionButton,
                bookmarked
                  ? "border-primary bg-primary-glow text-primary [&_svg]:fill-primary"
                  : "border-line bg-bg-secondary text-text-muted hover:border-line-hover hover:text-text-main",
              )}
            >
              <BookmarkIcon className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Toggle like"
              aria-pressed={Boolean(article.liked)}
              onClick={toggleLike}
              className={cn(
                actionButton,
                article.liked
                  ? "border-[#ef4444] bg-[rgba(239,68,68,0.1)] text-[#ef4444] [&_svg]:fill-[#ef4444]"
                  : "border-line bg-bg-secondary text-text-muted hover:border-line-hover hover:text-text-main",
              )}
            >
              <HeartIcon className="size-3.5" />
              <span>{article.likes}</span>
            </button>
          </div>
        </div>

        {/* Audio Narration player */}
        <div className="mb-6 flex flex-col gap-2.5 rounded-lg border border-line bg-bg-primary p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleAudio}
              className="cursor-pointer rounded-md bg-primary px-3.5 py-1.5 text-left text-xs font-semibold text-text-inverse hover:bg-primary-hover"
            >
              {audioPlaying ? "⏸ Pause AI Voice Narration" : "▶ Play AI Voice Narration"}
            </button>
            <span className="text-[11px] text-text-muted">
              {formatAudioTime(audioPercent)}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-sm bg-bg-tertiary">
            <div
              className="h-full bg-primary transition-[width] duration-100 ease-linear"
              style={{ width: `${audioPercent}%` }}
            />
          </div>
        </div>

        {/* Content text */}
        <div className="mb-8 text-[15.5px] leading-[1.8] whitespace-pre-wrap text-text-main">
          {article.content.split("\n").map((paragraph, index) => {
            const trimmed = paragraph.trim();
            const isListItem = trimmed.startsWith("•") || trimmed.startsWith("1.");
            return (
              <p
                key={index}
                className={isListItem ? "ml-5 font-medium" : "mb-4"}
              >
                {paragraph}
              </p>
            );
          })}
        </div>

        {/* Integrated MYHitch Ecosystem widgets */}
        {widgets.length > 0 && (
          <div className="mb-8 flex flex-col gap-4 border-y border-line py-6">
            {widgets}
          </div>
        )}

        {/* Comments Board */}
        <div>
          <h3 className="mb-4 font-heading text-base leading-[1.25] font-bold text-text-main">
            Discussion ({article.comments.length})
          </h3>
          <div className="mb-6 flex flex-col gap-3">
            <textarea
              rows={2}
              className={formControl}
              placeholder="Join the discussion under verified guidelines..."
              value={draftComment}
              onChange={(event) => setDraftComment(event.target.value)}
            />
            <Button size="sm" className="self-start" onClick={postComment}>
              Post Comment
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {article.comments.length === 0 ? (
              <p className="p-3 text-center text-[12.5px] text-text-muted">
                No comments yet. Be the first to start the discussion.
              </p>
            ) : (
              article.comments.map((comment, index) => (
                /* `.comment-item` */
                <div
                  key={index}
                  className="mb-3 rounded-lg border border-line bg-bg-primary p-4"
                >
                  <div className="mb-2 flex justify-between text-[11.5px]">
                    <span className="font-semibold">{comment.name}</span>
                    <span className="text-text-muted">{comment.date}</span>
                  </div>
                  <p className="text-[13px] text-text-main">{comment.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={buttonClasses("secondary", "sm", "mb-5")}
    >
      ← Back
    </button>
  );
}

export default function ArticlePage() {
  return (
    <Suspense fallback={null}>
      <ArticleDetail />
    </Suspense>
  );
}
