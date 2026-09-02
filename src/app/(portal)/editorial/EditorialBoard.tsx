"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { formControl, formControlSm, formLabel } from "@/components/ui/Form";
import { dashCard, dashHeading, StatChip } from "@/components/ui/DashboardKit";
import {
  BarChartIcon,
  CalendarIcon,
  CheckIcon,
  ColumnsIcon,
  CpuIcon,
  FolderIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { RichContentRenderer, ArticlePreviewModal } from "@/components/ui/RichEditor";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import type { ReviewQueueItem } from "@/lib/articles";
import { approveAndPublish, rejectSubmission, requestRevisions } from "./actions";

const EDITORS = ["Editor Sarah Vance", "Assoc. Editor Alex Rostova", "Mod Team Auto"];
const DEFAULT_SCHEDULE = "2026-07-21T10:00";

const queueItem = "cursor-pointer rounded-lg border p-4 transition-all duration-200";
const checkItem = "flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs";

export function EditorialBoard({ queue }: { queue: ReviewQueueItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const localDateTime = (iso: string) =>
    mounted
      ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : iso.slice(0, 16).replace("T", " ");
  const localTime = (iso: string) =>
    mounted
      ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : iso.slice(11, 16);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [assignee, setAssignee] = useState(EDITORS[0]);
  const [scheduleDate, setScheduleDate] = useState(DEFAULT_SCHEDULE);
  const [showPreview, setShowPreview] = useState(false);

  const selected = queue.find((item) => item.id === selectedId) ?? null;
  const avgScore = queue.length
    ? Math.round(queue.reduce((sum, item) => sum + item.aiScore, 0) / queue.length)
    : 0;
  const highQuality = queue.filter((item) => item.aiScore > 90).length;

  function reset() {
    setSelectedId(null);
    setFeedback("");
  }

  function doApprove(id: string) {
    startTransition(async () => {
      await approveAndPublish(id, scheduleDate);
      reset();
      router.refresh();
      alert("Approved and published successfully.");
    });
  }

  function doRevise(id: string) {
    const text = feedback.trim();
    if (!text) {
      alert("Please write comments or revision requirements for the author.");
      return;
    }
    startTransition(async () => {
      await requestRevisions(id, text, assignee);
      reset();
      router.refresh();
      alert("Revision request sent to the author.");
    });
  }

  function doReject(id: string) {
    const text = feedback.trim();
    if (!text) {
      alert("Please write a reason for rejecting — the author will see it and can appeal.");
      return;
    }
    if (!confirm("Reject this submission? The author will be notified with your reason.")) return;
    startTransition(async () => {
      await rejectSubmission(id, text);
      reset();
      router.refresh();
    });
  }

  // Full-screen review view when an article is selected
  if (selected) {
    return (
      <>
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={reset}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-bg-secondary px-3 py-1.5 text-xs font-semibold text-text-muted hover:border-line-hover hover:text-text-main"
          >
            ← Back to Queue
          </button>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-bold",
                selected.aiScore > 90
                  ? "bg-[rgba(5,150,105,0.1)] text-success"
                  : "bg-primary-glow text-primary",
              )}
            >
              AI Score: {selected.aiScore}/100
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPreview(true)}
            >
              Preview as Published
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_340px] gap-6 max-[992px]:grid-cols-1">
          {/* Main article content area */}
          <div className="min-w-0">
            {/* Article header */}
            <div className="mb-6 rounded-xl border border-line bg-bg-secondary p-6">
              <h1 className="mb-4 font-heading text-2xl leading-[1.25] font-bold text-text-main max-[640px]:text-xl">
                {selected.title}
              </h1>

              <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-text-muted">
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="size-3 align-middle" /> <strong>Author:</strong> {selected.author} ({selected.authorRank})
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="size-3 align-middle" /> <strong>Submitted:</strong> {localDateTime(selected.submittedAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <FolderIcon className="size-3 align-middle" /> <strong>Category:</strong> {selected.category}
                </span>
                <span className="inline-flex items-center gap-1">
                  <strong>Type:</strong> {selected.type}
                </span>
              </div>
            </div>

            {/* Article body — full-width reading area */}
            <div className="mb-6 rounded-xl border border-line bg-bg-secondary p-8 text-[15px] leading-[1.75] max-[640px]:p-5">
              {isRichContent(selected.content) ? (
                <RichContentRenderer content={selected.content} />
              ) : (
                <div className="whitespace-pre-wrap">{selected.content}</div>
              )}
            </div>
          </div>

          {/* Right sidebar: AI report + actions */}
          <div className="flex flex-col gap-5 max-[992px]:order-first">
            {/* AI review report */}
            <div className="rounded-xl border border-line bg-bg-secondary p-5">
              <h4 className="mb-3 flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-primary">
                <CpuIcon className="size-4 align-middle text-primary" /> AI Automated Review
              </h4>
              <div className="flex flex-col gap-3">
                <div className={checkItem}>
                  <span className="text-text-muted">Grammar &amp; Plagiarism:</span>
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckIcon className="size-3 align-middle" strokeWidth={3} /> Passed ({selected.plagiarism})
                  </span>
                </div>
                <div className={checkItem}>
                  <span className="text-text-muted">Readability:</span>
                  <span>{selected.readability}</span>
                </div>
                <div className={checkItem}>
                  <span className="text-text-muted">Sentiment:</span>
                  <span>{selected.sentiment}</span>
                </div>
                <div className={checkItem}>
                  <span className="text-text-muted">Quality Score:</span>
                  <span className="font-bold text-success">{selected.aiScore}/100</span>
                </div>
              </div>
            </div>

            {/* Editor actions */}
            <div className="rounded-xl border border-line bg-bg-secondary p-5">
              <h4 className="mb-3 font-heading text-[13.5px] font-bold text-text-main">
                Editor Actions
              </h4>

              <div className="mb-4">
                <label htmlFor="reviewFeedbackText" className={formLabel}>
                  Feedback / Revision Notes
                </label>
                <textarea
                  id="reviewFeedbackText"
                  rows={4}
                  className={cn(formControl, "w-full")}
                  placeholder="Write comments or required revisions for the author..."
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                />
              </div>

              <div className="mb-4">
                <label htmlFor="editorAssignee" className={formLabel}>Assign Editor</label>
                <select id="editorAssignee" className={formControlSm} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  {EDITORS.map((editor) => <option key={editor}>{editor}</option>)}
                </select>
              </div>

              <div className="mb-5">
                <label htmlFor="pubScheduleDate" className={formLabel}>Schedule Publication</label>
                <input id="pubScheduleDate" type="datetime-local" className={formControlSm} value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
              </div>

              <div className="flex flex-col gap-2">
                <Button disabled={isPending} onClick={() => doApprove(selected.id)} className="w-full">
                  Approve &amp; Publish
                </Button>
                <Button variant="secondary" disabled={isPending} onClick={() => doRevise(selected.id)} className="w-full">
                  Request Revisions
                </Button>
                <Button
                  variant="secondary"
                  disabled={isPending}
                  className="w-full border-[rgba(239,68,68,0.2)] text-danger"
                  onClick={() => doReject(selected.id)}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview modal */}
        {showPreview && (
          <ArticlePreviewModal
            title={selected.title}
            content={selected.content}
            author={selected.author}
            category={selected.category}
            contentType={selected.type}
            authorVerified={selected.authorVerified}
            authorRank={selected.authorRank}
            license={selected.license}
            articleId={selected.id}
            onClose={() => setShowPreview(false)}
          />
        )}
      </>
    );
  }

  // Queue list view (no article selected)
  return (
    <>
      <ViewHeader
        title="Editorial Workflow"
        subtitle="Review, assign, and schedule articles submitted by authors."
      />

      <div className="mb-6 grid grid-cols-3 gap-4 max-[560px]:grid-cols-1">
        <StatChip icon={<ColumnsIcon className="size-4" />} value={queue.length} label="Pending" />
        <StatChip icon={<BarChartIcon className="size-4" />} value={avgScore || "—"} label="Avg AI score" />
        <StatChip icon={<CheckIcon className="size-4" strokeWidth={3} />} value={highQuality} label="High quality" accent />
      </div>

      <div className={dashCard}>
        <h3 className={dashHeading}>
          <ColumnsIcon className="size-[18px] text-primary" /> Pending Reviews
        </h3>
        {queue.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-text-muted">
            All clear! There are no submissions pending moderation.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-4">
            {queue.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(item.id);
                  }
                }}
                className={cn(
                  queueItem,
                  "border-line bg-bg-primary hover:border-primary hover:shadow-card",
                )}
              >
                <div className="mb-2 flex justify-between text-[10.5px] text-text-muted">
                  <span>{item.category} · {item.type}</span>
                  <span>{localTime(item.submittedAt)}</span>
                </div>
                <div className="mb-2 text-[14.5px] font-semibold">{item.title}</div>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span>By {item.author}</span>
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 font-bold",
                      item.aiScore > 90
                        ? "bg-[rgba(5,150,105,0.1)] text-success"
                        : "bg-primary-glow text-primary",
                    )}
                  >
                    AI Score: {item.aiScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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
