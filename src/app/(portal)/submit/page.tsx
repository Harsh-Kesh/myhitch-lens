"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import { RichEditor, ArticlePreviewModal } from "@/components/ui/RichEditor";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";

import { createDraft, saveDraft, submitForReview, listTags, loadDraft } from "./actions";

const CONTENT_TYPES = [
  { value: "Blog", label: "Blog Post" },
  { value: "News", label: "News" },
  { value: "Report", label: "Report / Industry Whitepaper" },
  { value: "Research Paper", label: "Research Paper" },
];

const MAX_TAGS = 5;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function SubmitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("draft");

  const [articleId, setArticleId] = useState<string | null>(editId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<string>("");
  const [contentType, setContentType] = useState("Blog");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [draftLoading, setDraftLoading] = useState(!!editId);
  const [showPreview, setShowPreview] = useState(false);

  // Revision feedback state
  const [revisionNotes, setRevisionNotes] = useState<string[]>([]);
  const [draftStatus, setDraftStatus] = useState<string>("draft");

  // Tag picker state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showSubmitPanel, setShowSubmitPanel] = useState(false);
  const [isSubmitting, startSubmit] = useTransition();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(false);

  // Load available tags
  useEffect(() => {
    listTags().then(setAvailableTags);
  }, []);

  // Load existing draft if editing — block editor render until loaded
  useEffect(() => {
    if (!editId || initialLoadRef.current) return;
    initialLoadRef.current = true;
    loadDraft(editId).then((draft) => {
      if (draft) {
        setTitle(draft.title);
        setContent(draft.content);
        setContentType(draft.contentType);
        setSelectedTags(draft.tags);
        setDraftStatus(draft.status);
        if (draft.revisionNotes && draft.revisionNotes.length > 0) {
          setRevisionNotes(draft.revisionNotes);
        }
      }
      setDraftLoading(false);
    });
  }, [editId]);

  // Create draft on first content change
  const ensureDraft = useCallback(async () => {
    if (articleId) return articleId;
    const result = await createDraft();
    if ("error" in result) return null;
    setArticleId(result.id);
    return result.id;
  }, [articleId]);

  // Auto-save
  const scheduleAutoSave = useCallback(
    (field: "title" | "content", value: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const id = await ensureDraft();
        if (!id) return;
        setSaveStatus("saving");
        const result = await saveDraft({
          articleId: id,
          ...(field === "title" ? { title: value } : { content: value }),
        });
        setSaveStatus(result?.error ? "error" : "saved");
      }, 2000);
    },
    [ensureDraft],
  );

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleAutoSave("title", value);
  }

  function handleContentUpdate(json: string) {
    setContent(json);
    scheduleAutoSave("content", json);
  }

  // Tag management
  function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedTags.length >= MAX_TAGS) return;
    if (selectedTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    setSelectedTags((prev) => [...prev, trimmed]);
    setTagInput("");
  }

  function removeTag(name: string) {
    setSelectedTags((prev) => prev.filter((t) => t !== name));
  }

  const filteredSuggestions = tagInput.trim()
    ? availableTags
        .filter(
          (t) =>
            t.toLowerCase().includes(tagInput.toLowerCase()) &&
            !selectedTags.some((s) => s.toLowerCase() === t.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  // Submit for review
  function handleSubmit() {
    if (!articleId) return;
    startSubmit(async () => {
      const result = await submitForReview({
        articleId,
        contentType,
        tagNames: selectedTags,
      });
      if (result?.error) {
        alert(result.error);
      }
    });
  }

  const saveLabel: Record<SaveStatus, string> = {
    idle: "",
    saving: "Saving...",
    saved: "Draft saved",
    error: "Save failed",
  };

  // Word count from content JSON
  let wordCount = 0;
  try {
    if (content) {
      const text = extractTextFromJson(JSON.parse(content));
      wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    }
  } catch {
    // ignore parse errors
  }
  // ~200 words/min. Show "< 1 min" below a minute so the estimate visibly
  // reacts to short content instead of sitting on a flat "1 min read".
  const readingLabel =
    wordCount === 0
      ? "0 min read"
      : wordCount < 200
        ? "< 1 min read"
        : `${Math.round(wordCount / 200)} min read`;

  return (
    <>
      <ViewHeader
        title="Write Article"
        subtitle="Focus on your writing. Your draft saves automatically."
        actions={
          <div className="flex items-center gap-3">
            {saveStatus !== "idle" && (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  saveStatus === "saving" && "bg-warning/10 text-warning",
                  saveStatus === "saved" && "bg-success/10 text-success",
                  saveStatus === "error" && "bg-danger/10 text-danger",
                )}
              >
                {saveLabel[saveStatus]}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPreview(true)}
              disabled={!title.trim() && wordCount === 0}
            >
              Preview
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/author-dashboard")}
            >
              Back to Dashboard
            </Button>
            <Button size="sm" onClick={() => setShowSubmitPanel(true)}>
              {draftStatus === "changes_requested" ? "Resubmit for Review" : "Submit for Review"}
            </Button>
          </div>
        }
      />

      {/* Revision feedback banner */}
      {draftStatus === "changes_requested" && revisionNotes.length > 0 && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <svg className="size-4 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span className="text-sm font-bold text-warning">Revision Requested by Editor</span>
          </div>
          {revisionNotes.map((note, i) => (
            <div key={i} className="mt-2 rounded border border-line bg-bg-primary p-3 text-[13px] text-text-main">
              {note}
            </div>
          ))}
          <p className="mt-2 text-[11px] text-text-muted">
            Make the requested changes above, then click &quot;Resubmit for Review&quot; when ready.
          </p>
        </div>
      )}

      {/* Title input */}
      <input
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Article title..."
        className="mb-4 w-full border-none bg-transparent font-heading text-3xl font-bold text-text-main outline-none placeholder:text-text-muted/40"
      />

      {/* Editor — deferred until draft loads so Tiptap gets the saved content */}
      {draftLoading ? (
        <div className="flex min-h-[60vh] items-center justify-center rounded-xl border border-line bg-bg-secondary text-sm text-text-muted">
          Loading draft...
        </div>
      ) : (
        <RichEditor
          key={articleId || "new"}
          content={content || undefined}
          onUpdate={handleContentUpdate}
          placeholder="Start writing your article... Use the toolbar above for formatting."
        />
      )}

      {/* Stats bar */}
      <div className="mt-3 flex items-center gap-6 text-xs text-text-muted">
        <span>{wordCount} words</span>
        <span>{readingLabel}</span>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <ArticlePreviewModal
          title={title}
          content={content}
          author="Dr. Sarah Chen"
          category={contentType}
          contentType={contentType}
          tags={selectedTags}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Submit panel (overlay) */}
      {showSubmitPanel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowSubmitPanel(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-[min(420px,90vw)] flex-col overflow-y-auto border-l border-line bg-bg-secondary p-6 shadow-card">
            <h3 className="mb-6 font-heading text-lg font-bold text-text-main">
              {draftStatus === "changes_requested" ? "Resubmit for Editorial Review" : "Submit for Editorial Review"}
            </h3>

            {/* Content type */}
            <div className="mb-5">
              <label className={formLabel}>Content Type</label>
              <select
                className={formControl}
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="mb-5">
              <label className={formLabel}>
                Tags ({selectedTags.length}/{MAX_TAGS})
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary-glow px-3 py-1 text-xs font-semibold text-primary"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="cursor-pointer text-primary/60 hover:text-primary"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              {selectedTags.length < MAX_TAGS && (
                <div className="relative">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    placeholder="Type a tag and press Enter..."
                    className={formControl}
                  />
                  {filteredSuggestions.length > 0 && (
                    <div className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-lg border border-line bg-bg-primary shadow-card">
                      {filteredSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTag(tag)}
                          className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-text-main hover:bg-surface-hover"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-text-muted">
                Tags help categorise your article. The system assigns the best-fit category automatically.
              </p>
            </div>

            {/* Media notice */}
            <div className="mb-6 rounded-lg border border-warning/30 bg-warning/5 p-4">
              <p className="text-xs font-semibold text-warning">Media Policy</p>
              <p className="mt-1 text-[12px] text-text-muted">
                Uploaded images, videos, and audio must not contain logos, brand marks, or watermarks. Articles may be purchased by brands who apply their own branding. The editor will check for compliance.
              </p>
            </div>

            {/* Summary */}
            <div className="mb-6 rounded-lg border border-line bg-bg-primary p-4">
              <div className="flex justify-between text-xs text-text-muted">
                <span>Title</span>
                <span className={cn("font-medium", title.trim() ? "text-success" : "text-danger")}>
                  {title.trim() ? "Set" : "Missing"}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-xs text-text-muted">
                <span>Content</span>
                <span className={cn("font-medium", wordCount >= 20 ? "text-success" : "text-danger")}>
                  {wordCount} words
                </span>
              </div>
              <div className="mt-2 flex justify-between text-xs text-text-muted">
                <span>Tags</span>
                <span className={cn("font-medium", selectedTags.length > 0 ? "text-success" : "text-danger")}>
                  {selectedTags.length} selected
                </span>
              </div>
            </div>

            <div className="mt-auto flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowSubmitPanel(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={isSubmitting || !title.trim() || selectedTags.length === 0}
              >
                {isSubmitting ? "Submitting..." : draftStatus === "changes_requested" ? "Resubmit" : "Submit"}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function extractTextFromJson(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) {
    return n.content.map(extractTextFromJson).join(" ");
  }
  return "";
}
