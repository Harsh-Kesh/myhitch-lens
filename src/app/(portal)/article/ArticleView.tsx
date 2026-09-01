"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { Button, buttonClasses } from "@/components/ui/Button";
import { formControl } from "@/components/ui/Form";
import {
  BookmarkIcon,
  BriefcaseIcon,
  HeartIcon,
  SendIcon,
  ShoppingCartIcon,
} from "@/components/ui/icons";
import { RichContentRenderer } from "@/components/ui/RichEditor";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { useLensValue } from "@/hooks/useLensValue";
import { getIntegrations } from "@/lib/lensStore";
import { defaultIntegrations } from "@/data/defaults";
import { cn } from "@/lib/cn";
import type { ArticleDetail } from "@/lib/articles";
import type { OwnershipInfo } from "@/lib/marketplace";
import { licenseShort } from "@/lib/licenses";
import { postComment, recordArticleView, reportCopyright, toggleBookmark, toggleFollow, toggleLike } from "./actions";

const AUDIO_DURATION_SECONDS = 154;
const AUDIO_TICK_MS = 300;
const AUDIO_STEP_PERCENT = 2;

function formatAudioTime(percent: number): string {
  const seconds = Math.floor((percent / 100) * AUDIO_DURATION_SECONDS);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder < 10 ? "0" : ""}${remainder} / 2:34`;
}

const actionButton =
  "flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-60";

const widgetBox =
  "flex items-center justify-between gap-4 rounded-lg border border-line bg-bg-primary p-4 max-[560px]:flex-col max-[560px]:items-stretch max-[560px]:gap-3";

function IntegrationWidget({ icon, title, desc, action }: { icon: ReactNode; title: string; desc: string; action: ReactNode }) {
  return (
    <div className={widgetBox}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex shrink-0 items-center text-xl">{icon}</span>
        <div>
          <h5 className="font-heading text-[13.5px] font-semibold text-text-main">{title}</h5>
          <p className="text-[11.5px] text-text-muted">{desc}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function ArticleView({
  article,
  ownership,
}: {
  article: ArticleDetail;
  ownership?: OwnershipInfo | null;
}) {
  const router = useRouter();
  const integrations = useLensValue(getIntegrations, defaultIntegrations);
  const [isPending, startTransition] = useTransition();

  const [draftComment, setDraftComment] = useState("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioPercent, setAudioPercent] = useState(0);
  const audioTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAudio = useCallback(() => {
    if (audioTimer.current) clearInterval(audioTimer.current);
    audioTimer.current = null;
  }, []);
  useEffect(() => stopAudio, [stopAudio]);

  // Count one view per article per browser session (dedupes refreshes).
  useEffect(() => {
    if (article.isOwnArticle) return;
    const key = `viewed:${article.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void recordArticleView(article.id);
  }, [article.id, article.isOwnArticle]);

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

  function runLike() {
    startTransition(async () => {
      await toggleLike(article.id);
      router.refresh();
    });
  }
  function runBookmark() {
    startTransition(async () => {
      await toggleBookmark(article.id);
      router.refresh();
    });
  }
  function runFollow() {
    startTransition(async () => {
      await toggleFollow(article.authorId);
      router.refresh();
    });
  }
  function runReport() {
    const details = window.prompt(
      "Report this article for copyright infringement. Describe the issue (e.g. where the original was published):",
      "",
    );
    if (details === null) return;
    startTransition(async () => {
      const res = await reportCopyright(article.id, details);
      if ("error" in res) alert(res.error);
      else alert("Thanks — your report was sent to the moderation team.");
    });
  }

  function runPostComment() {
    const text = draftComment.trim();
    if (!text) return;
    startTransition(async () => {
      const res = await postComment(article.id, text);
      if (res && "error" in res) {
        alert(res.error);
        return;
      }
      setDraftComment("");
      router.refresh();
    });
  }

  const widgets: ReactNode[] = [];
  if (integrations.services) {
    widgets.push(
      <IntegrationWidget key="services" icon={<BriefcaseIcon className="size-5 text-primary" />} title={`Connect with ${article.author}`} desc={`Request consulting on topics involving ${article.category} and related operations.`} action={<Button size="sm" onClick={() => alert(`Routing to scheduling calendar for ${article.author}... (Simulated)`)}>Book Consultation</Button>} />,
    );
  }
  if (integrations.mart && ["Supply Chain", "AI", "Technology"].includes(article.category)) {
    widgets.push(
      <IntegrationWidget key="mart" icon={<ShoppingCartIcon className="size-5 text-primary" />} title="Recommended Procurement Products" desc="Mentioned Hardware, Telemetry Sensors, and Cloud API listings on MYHitch Mart." action={<Button variant="secondary" size="sm" onClick={() => alert("Displaying 3 verified hardware modules found in text (Sandbox)...")}>Open Mart Links</Button>} />,
    );
  }
  if (integrations.travel && article.category === "Travel") {
    widgets.push(
      <IntegrationWidget key="travel" icon={<SendIcon className="size-5 text-primary" />} title="JetNRest SAF Travel Search" desc="Search carbon-offset airline bookings directly to author's research hubs." action={<Button size="sm" onClick={() => alert("Launching flight lookup modal (Simulated SAF paths)...")}>Compare SAF Flights</Button>} />,
    );
  }
  if (integrations.donations) {
    widgets.push(
      <IntegrationWidget key="donations" icon={<HeartIcon className="size-5 text-primary" />} title={`Support ${article.author}'s Research`} desc="Send micro-grants directly to support ongoing work." action={<Button variant="secondary" size="sm" onClick={() => alert("Connecting secure donation gateway... (Simulated)")}>Send Donation</Button>} />,
    );
  }

  return (
    <>
      <button type="button" onClick={() => router.back()} className={buttonClasses("secondary", "sm", "mb-5")}>
        ← Back
      </button>

      <div className="min-h-[400px] rounded-xl border border-line bg-bg-secondary p-8 max-[640px]:p-5">
        <div className="mb-6">
          <span className="text-[11px] font-bold tracking-[0.5px] text-primary uppercase">{article.category}</span>
        </div>

        {ownership && (
          <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-bg-tertiary px-4 py-3">
            <span className="rounded bg-text-muted/10 px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-text-muted uppercase">
              Owned by
            </span>
            <span className="text-[12.5px] text-text-muted">
              <strong className="text-text-main">{ownership.brandName}</strong>
              {ownership.tagline && <span> — “{ownership.tagline}”</span>}
              <span> · Written by {article.author} (Verified)</span>
            </span>
          </div>
        )}

        <h1 className="mb-4 font-heading text-[28px] leading-[1.3] font-bold text-text-main max-[640px]:text-[23px] max-[480px]:text-[20px]">
          {article.title}
        </h1>

        <div className="mb-6 flex flex-wrap items-center gap-y-3 rounded-lg border border-line bg-bg-primary px-[18px] py-3 max-[480px]:px-4">
          <div className="mr-3 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-text-inverse">
            {article.author.charAt(0)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1 text-[13.5px] font-semibold">
              {article.author}
              {article.authorVerified && <VerifiedBadge size="xs" />}
            </span>
            <span className="text-[11px] text-text-muted">
              {article.authorRank} · {article.followerCount.toLocaleString()} followers
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!article.isOwnArticle && (
              <button
                type="button"
                disabled={isPending}
                onClick={runFollow}
                className={cn(
                  "cursor-pointer rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
                  article.followingAuthor
                    ? "border-line bg-bg-secondary text-text-muted hover:border-line-hover hover:text-text-main"
                    : "border-primary bg-primary text-text-inverse hover:bg-primary-hover",
                )}
              >
                {article.followingAuthor ? "Following" : "+ Follow"}
              </button>
            )}
            <button type="button" aria-label="Toggle bookmark" aria-pressed={article.bookmarked} disabled={isPending} onClick={runBookmark} className={cn(actionButton, article.bookmarked ? "border-primary bg-primary-glow text-primary [&_svg]:fill-primary" : "border-line bg-bg-secondary text-text-muted hover:border-line-hover hover:text-text-main")}>
              <BookmarkIcon className="size-3.5" />
            </button>
            <button type="button" aria-label="Toggle like" aria-pressed={article.liked} disabled={isPending} onClick={runLike} className={cn(actionButton, article.liked ? "border-[#ef4444] bg-[rgba(239,68,68,0.1)] text-[#ef4444] [&_svg]:fill-[#ef4444]" : "border-line bg-bg-secondary text-text-muted hover:border-line-hover hover:text-text-main")}>
              <HeartIcon className="size-3.5" />
              <span>{article.likes}</span>
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-2.5 rounded-lg border border-line bg-bg-primary p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={toggleAudio} className="cursor-pointer rounded-md bg-primary px-3.5 py-1.5 text-left text-xs font-semibold text-text-inverse hover:bg-primary-hover">
              {audioPlaying ? "⏸ Pause AI Voice Narration" : "▶ Play AI Voice Narration"}
            </button>
            <span className="text-[11px] text-text-muted">{formatAudioTime(audioPercent)}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-sm bg-bg-tertiary">
            <div className="h-full bg-primary transition-[width] duration-100 ease-linear" style={{ width: `${audioPercent}%` }} />
          </div>
        </div>

        <div className="mb-8 text-[15.5px] leading-[1.8] text-text-main">
          {isRichContent(article.content) ? (
            <RichContentRenderer content={article.content} />
          ) : (
            <div className="whitespace-pre-wrap">
              {article.content.split("\n").map((paragraph, index) => {
                const trimmed = paragraph.trim();
                const isListItem = trimmed.startsWith("•") || trimmed.startsWith("1.");
                return <p key={index} className={isListItem ? "ml-5 font-medium" : "mb-4"}>{paragraph}</p>;
              })}
            </div>
          )}
        </div>

        {widgets.length > 0 && <div className="mb-8 flex flex-col gap-4 border-y border-line py-6">{widgets}</div>}

        {/* Rights / copyright bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-bg-primary px-4 py-3 text-[12px] text-text-muted">
          <span>
            <strong className="text-text-main">© {article.author}.</strong>{" "}
            {licenseShort(article.license)}. Reproduced only with permission.{" "}
            <a href={`/verify?id=${article.id}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Verify authenticity
            </a>
          </span>
          <button
            type="button"
            onClick={runReport}
            disabled={isPending}
            className="shrink-0 rounded-md border border-line px-3 py-1.5 text-[11.5px] font-semibold text-text-muted hover:border-danger/40 hover:text-danger disabled:opacity-60"
          >
            Report copyright
          </button>
        </div>

        <div>
          <h3 className="mb-4 font-heading text-base leading-[1.25] font-bold text-text-main">Discussion ({article.comments.length})</h3>
          {article.isOwnArticle ? (
            <p className="mb-6 rounded-lg border border-line bg-bg-primary p-3 text-center text-[12.5px] text-text-muted">
              Authors can’t comment on their own article.
            </p>
          ) : (
            <div className="mb-6 flex flex-col gap-3">
              <textarea rows={2} className={formControl} placeholder="Join the discussion under verified guidelines..." value={draftComment} onChange={(event) => setDraftComment(event.target.value)} />
              <Button size="sm" className="self-start" disabled={isPending} onClick={runPostComment}>Post Comment</Button>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {article.comments.length === 0 ? (
              <p className="p-3 text-center text-[12.5px] text-text-muted">No comments yet. Be the first to start the discussion.</p>
            ) : (
              article.comments.map((comment) => (
                <div key={comment.id} className="mb-3 rounded-lg border border-line bg-bg-primary p-4">
                  <div className="mb-2 flex justify-between text-[11.5px]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {comment.author}
                      {comment.verified && <VerifiedBadge size="xs" />}
                    </span>
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

function isRichContent(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && parsed.type === "doc";
  } catch {
    return false;
  }
}
