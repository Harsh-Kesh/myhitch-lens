"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import type { Editor } from "@tiptap/react";

import { RichEditor, ArticlePreviewModal, replaceTextInEditor } from "@/components/ui/RichEditor";
import { insertHeading, insertPullQuote, isPulledQuote } from "@/lib/editorLayout";
import type { LayoutHints, PageBreakdown } from "@/lib/layoutHints";
import type { SeoMetadata } from "@/lib/seoMetadata";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import { LICENSE_OPTIONS } from "@/lib/licenses";

import type { ArticleDestination } from "@prisma/client";

import type { WritingCheckResult } from "@/lib/writingCheck";
import type { TagSuggestionResult } from "@/lib/tagSuggestions";
import type { ChecklistItem } from "@/lib/preSubmitCheck";

import {
  createDraft,
  saveDraft,
  submitForReview,
  listTags,
  loadDraft,
  getMyProfileSummary,
  checkArticleWriting,
  suggestArticleTitleAndExcerpt,
  suggestArticleTags,
  suggestArticleSeo,
  suggestMediaText,
  rewriteSelectedText,
  getLayoutHints,
  runPreSubmitChecklist,
  type MyPlanSummary,
} from "./actions";

const CONTENT_TYPES = [
  { value: "Blog", label: "Blog Post" },
  { value: "News", label: "News" },
  { value: "Report", label: "Report / Industry Whitepaper" },
  { value: "Research Paper", label: "Research Paper" },
];

type LayoutResult = { hints: LayoutHints; pages: PageBreakdown; maxPages: number };

const MAX_TAGS = 5;
const MAX_EXCERPT = 200; // keep in sync with MAX_EXCERPT_CHARS in lib/titleExcerpt.ts
// Keep in sync with lib/seoMetadata.ts
const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 155;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function SubmitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("draft");

  const [articleId, setArticleId] = useState<string | null>(editId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<string>("");
  const [contentType, setContentType] = useState("Blog");
  const [license, setLicense] = useState("all_rights_reserved");
  const [destination, setDestination] = useState<ArticleDestination>("main_app");
  const [rightsAttested, setRightsAttested] = useState(false);
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

  // AI writing check state
  const [showWritingCheck, setShowWritingCheck] = useState(false);
  // Layout hints (pull quotes, headings, page breaks)
  const [showLayout, setShowLayout] = useState(false);
  const [layoutRunning, setLayoutRunning] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  // Outcome of each Insert button, keyed "q0", "h1", ...
  const [layoutApplied, setLayoutApplied] = useState<Record<string, "done" | "exists" | "missing">>({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<WritingCheckResult | null>(null);
  // Per-suggestion outcome of the Replace button, keyed by its index in the result.
  const [replaceState, setReplaceState] = useState<Record<number, "replaced" | "missing">>({});
  // Excerpt shown on article cards, plus the AI's title/excerpt suggestions for it.
  const [excerpt, setExcerpt] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [excerptSuggestion, setExcerptSuggestion] = useState("");
  // Pre-submit checklist
  const [checklistRunning, setChecklistRunning] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  // Search metadata (SEO) fields, and the AI's suggestion for them
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [seoSuggesting, setSeoSuggesting] = useState(false);
  const [seoError, setSeoError] = useState<string | null>(null);
  const [seoSuggestion, setSeoSuggestion] = useState<SeoMetadata | null>(null);
  const [tagSuggesting, setTagSuggesting] = useState(false);
  const [tagSuggestError, setTagSuggestError] = useState<string | null>(null);
  const [tagSuggestion, setTagSuggestion] = useState<TagSuggestionResult | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);
  // Latest title, read at click time so the editor doesn't re-render on every keystroke.
  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  const handleRewriteText = useCallback((text: string, action: string) => rewriteSelectedText(text, action), []);
  const handleSuggestMediaText = useCallback(
    async (src: string) => {
      const res = await suggestMediaText(src, titleRef.current);
      return "error" in res ? res : res.result;
    },
    [],
  );

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(false);

  // Escape closes the submit / writing-check panel, matching the app's other modals/panels.
  useEffect(() => {
    if (!showSubmitPanel && !showWritingCheck && !showLayout) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setShowSubmitPanel(false);
      setShowWritingCheck(false);
      setShowLayout(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showSubmitPanel, showWritingCheck, showLayout]);

  // Load available tags
  useEffect(() => {
    listTags().then(setAvailableTags);
  }, []);

  // Real author name + verified status, for an accurate preview.
  const [profile, setProfile] = useState<MyPlanSummary>({
    name: "Author",
    verified: false,
    canSponsor: false,
    canEmbedMedia: false,
    allowance: { limit: null, used: 0, allowed: true },
  });
  useEffect(() => {
    getMyProfileSummary().then(setProfile);
  }, []);

  // A first submission uses up one of the plan's monthly submissions; a resubmission after
  // "changes requested" does not, so only block brand-new ones.
  const outOfSubmissions = !profile.allowance.allowed && draftStatus !== "changes_requested";

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
        if (draft.seo) {
          setSeoTitle(draft.seo.title);
          setSeoDescription(draft.seo.description);
          setSeoKeywords(draft.seo.keywords.join(", "));
        }
        if (draft.license) setLicense(draft.license);
        if (draft.destination) setDestination(draft.destination);
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

  // AI grammar & clarity check — suggestions only, nothing is changed in the article.
  async function handleCheckWriting() {
    setShowWritingCheck(true);
    setChecking(true);
    setCheckError(null);
    setCheckResult(null);
    setReplaceState({});
    try {
      const res = await checkArticleWriting(content);
      if ("error" in res) setCheckError(res.error);
      else setCheckResult(res.result);
    } catch {
      setCheckError("Writing check failed. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  // AI title options + excerpt. Nothing is applied until the author clicks a title or "Use this".
  async function handleSuggestTitleExcerpt() {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await suggestArticleTitleAndExcerpt(content, title);
      if ("error" in res) {
        setSuggestError(res.error);
      } else {
        setTitleOptions(res.result.titles);
        setExcerptSuggestion(res.result.excerpt);
      }
    } catch {
      setSuggestError("Suggestions failed. Please try again.");
    } finally {
      setSuggesting(false);
    }
  }

  // Layout hints: pull quotes, section headings, structure notes and page breaks. Nothing is applied until Insert.
  async function handleLayoutHints() {
    setShowLayout(true);
    setLayoutRunning(true);
    setLayoutError(null);
    setLayout(null);
    setLayoutApplied({});
    try {
      const res = await getLayoutHints(content, title);
      if ("error" in res) setLayoutError(res.error);
      else setLayout(res);
    } catch {
      setLayoutError("Layout hints failed. Please try again.");
    } finally {
      setLayoutRunning(false);
    }
  }

  function applyLayout(key: string, insert: (editor: Editor) => boolean, alreadyThere?: (editor: Editor) => boolean) {
    const editor = editorRef.current;
    const outcome = !editor ? "missing" : alreadyThere?.(editor) ? "exists" : insert(editor) ? "done" : "missing";
    setLayoutApplied((prev) => ({ ...prev, [key]: outcome }));
  }

  // Pre-submit checklist: rule checks + AI content review. Advisory; the Submit button still decides.
  async function handleRunChecklist() {
    setChecklistRunning(true);
    setChecklistError(null);
    try {
      const res = await runPreSubmitChecklist({
        articleId,
        title,
        content,
        excerpt,
        tagCount: selectedTags.length,
        rightsAttested,
      });
      if ("error" in res) setChecklistError(res.error);
      else setChecklist(res.items);
    } catch {
      setChecklistError("The check failed. Please try again.");
    } finally {
      setChecklistRunning(false);
    }
  }

  // AI search title, description and keywords. Nothing is applied until the author clicks "Use these".
  async function handleSuggestSeo() {
    setSeoSuggesting(true);
    setSeoError(null);
    try {
      const res = await suggestArticleSeo(content, title, excerpt);
      if ("error" in res) setSeoError(res.error);
      else setSeoSuggestion(res.result);
    } catch {
      setSeoError("Suggestions failed. Please try again.");
    } finally {
      setSeoSuggesting(false);
    }
  }

  function useSeoSuggestion() {
    if (!seoSuggestion) return;
    setSeoTitle(seoSuggestion.title);
    setSeoDescription(seoSuggestion.description);
    setSeoKeywords(seoSuggestion.keywords.join(", "));
  }

  // AI tag + content-type ideas. Nothing is applied until the author clicks Add / Use.
  async function handleSuggestTags() {
    setTagSuggesting(true);
    setTagSuggestError(null);
    try {
      const res = await suggestArticleTags(content, title);
      if ("error" in res) setTagSuggestError(res.error);
      else setTagSuggestion(res.result);
    } catch {
      setTagSuggestError("Suggestions failed. Please try again.");
    } finally {
      setTagSuggesting(false);
    }
  }

  function addAllSuggestedTags() {
    if (!tagSuggestion) return;
    setSelectedTags((prev) => {
      const next = [...prev];
      for (const { name } of tagSuggestion.tags) {
        if (next.length >= MAX_TAGS) break;
        if (!next.some((t) => t.toLowerCase() === name.toLowerCase())) next.push(name);
      }
      return next;
    });
  }

  // Apply one suggestion to the article. The editor's own update handler then autosaves it.
  function handleReplace(index: number, original: string, suggestion: string) {
    const editor = editorRef.current;
    const done = editor ? replaceTextInEditor(editor, original, suggestion) : false;
    setReplaceState((prev) => ({ ...prev, [index]: done ? "replaced" : "missing" }));
  }

  // Submit for review
  function handleSubmit() {
    if (!articleId) return;
    startSubmit(async () => {
      const result = await submitForReview({
        articleId,
        contentType,
        tagNames: selectedTags,
        license,
        rightsAttested,
        destination,
        summary: excerpt,
        seo: {
          title: seoTitle,
          description: seoDescription,
          keywords: seoKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        },
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
              onClick={handleCheckWriting}
              disabled={checking || wordCount === 0}
            >
              {checking ? "Checking..." : "Check Writing"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLayoutHints}
              disabled={layoutRunning || wordCount === 0}
            >
              {layoutRunning ? "Reviewing..." : "Layout Hints"}
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
          allowRichMedia={profile.canEmbedMedia}
          key={articleId || "new"}
          content={content || undefined}
          onUpdate={handleContentUpdate}
          onEditorReady={handleEditorReady}
          onSuggestMediaText={handleSuggestMediaText}
          onRewriteText={handleRewriteText}
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
          author={profile.name}
          category={contentType}
          articleId={articleId ?? undefined}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Layout hints panel (overlay) */}
      {showLayout && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowLayout(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Layout hints"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(460px,92vw)] flex-col overflow-y-auto border-l border-line bg-bg-secondary p-6 shadow-card"
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-text-main">Layout hints</h3>
              <button
                type="button"
                onClick={() => setShowLayout(false)}
                className="cursor-pointer text-xl leading-none text-text-muted hover:text-text-main"
                aria-label="Close layout hints"
              >
                &times;
              </button>
            </div>
            <p className="mb-5 text-[11px] text-text-muted">
              Pull quotes, section headings and page breaks for your article. Nothing is added until you click Insert.
            </p>

            {layoutRunning && (
              <div className="rounded-lg border border-line bg-bg-primary p-4 text-sm text-text-muted">Reviewing your layout...</div>
            )}
            {layoutError && !layoutRunning && (
              <div className="rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm text-danger">{layoutError}</div>
            )}

            {layout && !layoutRunning && (
              <div className="flex flex-col gap-5">
                {/* Page layout */}
                <section>
                  <h4 className="mb-1.5 text-xs font-bold text-text-main">Magazine pages</h4>
                  <div className="rounded-lg border border-line bg-bg-primary p-3">
                    <p
                      className={cn(
                        "text-[12.5px] font-semibold",
                        layout.pages.length > layout.maxPages ? "text-danger" : "text-text-main",
                      )}
                    >
                      Runs {layout.pages.length} page{layout.pages.length === 1 ? "" : "s"}. Your plan allows up to {layout.maxPages}.
                    </p>
                    {layout.pages.length > layout.maxPages && (
                      <p className="mt-1 text-[11px] text-danger">
                        It&apos;s too long to submit on your plan. Shorten it, or upgrade your plan.
                      </p>
                    )}
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {layout.pages.map((p) => (
                        <li key={p.number} className="text-[11.5px] text-text-muted">
                          <span className="font-semibold text-text-main">Page {p.number}</span> &middot; {p.words} words &middot;{" "}
                          {p.fillPercent}% full
                          {p.number > layout.maxPages && <span className="font-semibold text-danger"> &middot; over your limit</span>}
                          <br />
                          <span className="italic">ends &ldquo;&hellip;{p.endsWith}&rdquo;</span>
                        </li>
                      ))}
                    </ul>
                    {layout.pages.length > 1 && layout.pages[layout.pages.length - 1].fillPercent < 20 && (
                      <p className="mt-2 text-[11px] text-warning">
                        The last page is only {layout.pages[layout.pages.length - 1].fillPercent}% full. Trimming a few lines would
                        save a page.
                      </p>
                    )}
                  </div>
                </section>

                {/* Pull quotes */}
                <section>
                  <h4 className="mb-1.5 text-xs font-bold text-text-main">Pull quotes</h4>
                  {layout.hints.pullQuotes.length === 0 ? (
                    <p className="rounded-lg border border-line bg-bg-primary p-3 text-[12px] text-text-muted">
                      Nothing stood out as a good pull quote yet.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {layout.hints.pullQuotes.map((quote, i) => (
                        <li key={quote} className="rounded-lg border border-line bg-bg-primary p-3">
                          <p className="border-l-2 border-primary pl-2.5 text-[12.5px] text-text-main italic">&ldquo;{quote}&rdquo;</p>
                          <div className="mt-2 flex items-center gap-4">
                            {layoutApplied[`q${i}`] === "done" || layoutApplied[`q${i}`] === "exists" ? (
                              <span className="text-[11px] font-semibold text-success">
                                {layoutApplied[`q${i}`] === "exists" ? "Already in your article" : "Inserted"} &#10003;
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  applyLayout(`q${i}`, (ed) => insertPullQuote(ed, quote), (ed) => isPulledQuote(ed, quote))
                                }
                                className="cursor-pointer text-[11px] font-semibold text-primary hover:underline"
                              >
                                Insert as quote
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(quote)}
                              className="cursor-pointer text-[11px] font-semibold text-primary hover:underline"
                            >
                              Copy
                            </button>
                          </div>
                          {layoutApplied[`q${i}`] === "missing" && (
                            <p className="mt-1.5 text-[11px] text-warning">
                              Couldn&apos;t insert this &mdash; the paragraph it came from may have been edited.
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Headings */}
                <section>
                  <h4 className="mb-1.5 text-xs font-bold text-text-main">Section headings</h4>
                  {layout.hints.headings.length === 0 ? (
                    <p className="rounded-lg border border-line bg-bg-primary p-3 text-[12px] text-text-muted">
                      No headings needed. The article reads as one piece, or it&apos;s short.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {layout.hints.headings.map((h, i) => (
                        <li key={h.before} className="rounded-lg border border-line bg-bg-primary p-3">
                          <p className="text-[13px] font-bold text-text-main">{h.heading}</p>
                          <p className="mt-0.5 text-[11px] text-text-muted">
                            above &ldquo;{h.before}&hellip;&rdquo;
                          </p>
                          <div className="mt-2">
                            {layoutApplied[`h${i}`] === "done" ? (
                              <span className="text-[11px] font-semibold text-success">Inserted &#10003;</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => applyLayout(`h${i}`, (ed) => insertHeading(ed, h.before, h.heading))}
                                className="cursor-pointer text-[11px] font-semibold text-primary hover:underline"
                              >
                                Insert heading
                              </button>
                            )}
                          </div>
                          {layoutApplied[`h${i}`] === "missing" && (
                            <p className="mt-1.5 text-[11px] text-warning">
                              Couldn&apos;t find that paragraph &mdash; it may have been edited.
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Structure notes */}
                {layout.hints.notes.length > 0 && (
                  <section>
                    <h4 className="mb-1.5 text-xs font-bold text-text-main">Structure notes</h4>
                    <ul className="flex flex-col gap-2">
                      {layout.hints.notes.map((note) => (
                        <li key={note} className="rounded-lg border border-line bg-bg-primary p-3 text-[12px] text-text-main">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}

            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setShowLayout(false)}>
                Close
              </Button>
              <Button className="flex-1" onClick={handleLayoutHints} disabled={layoutRunning}>
                Check again
              </Button>
            </div>
          </div>
        </>
      )}

      {/* AI writing check panel (overlay) */}
      {showWritingCheck && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowWritingCheck(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Writing check"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(460px,92vw)] flex-col overflow-y-auto border-l border-line bg-bg-secondary p-6 shadow-card"
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-text-main">Writing check</h3>
              <button
                type="button"
                onClick={() => setShowWritingCheck(false)}
                className="cursor-pointer text-xl leading-none text-text-muted hover:text-text-main"
                aria-label="Close writing check"
              >
                &times;
              </button>
            </div>
            <p className="mb-5 text-[11px] text-text-muted">
              AI suggestions for grammar, spelling, punctuation and clarity. Nothing is changed in your article &mdash; you
              decide what to edit.
            </p>

            {checking && (
              <div className="rounded-lg border border-line bg-bg-primary p-4 text-sm text-text-muted">
                Reading your article...
              </div>
            )}

            {checkError && !checking && (
              <div className="rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm text-danger">{checkError}</div>
            )}

            {checkResult && !checking && (
              <>
                {checkResult.summary && (
                  <div className="mb-4 rounded-lg border border-line bg-bg-primary p-4 text-[13px] text-text-main">
                    {checkResult.summary}
                  </div>
                )}
                {checkResult.truncated && (
                  <p className="mb-3 text-[11px] text-warning">
                    Your article is very long, so only the first part was checked.
                  </p>
                )}
                {checkResult.issues.length === 0 ? (
                  <div className="rounded-lg border border-success/40 bg-success/5 p-4 text-sm text-success">
                    No problems found.
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-xs font-semibold text-text-muted">
                      {checkResult.issues.length} suggestion{checkResult.issues.length === 1 ? "" : "s"}
                    </p>
                    <ul className="flex flex-col gap-3">
                      {checkResult.issues.map((issue, i) => (
                        <li key={i} className="rounded-lg border border-line bg-bg-primary p-3">
                          <span className="mb-2 inline-block rounded-full bg-primary-glow px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                            {issue.type}
                          </span>
                          <p className="text-[12.5px] text-text-muted line-through">{issue.original}</p>
                          <p className="mt-1 text-[12.5px] font-semibold text-text-main">{issue.suggestion}</p>
                          <p className="mt-1.5 text-[11px] text-text-muted">{issue.reason}</p>
                          <div className="mt-2 flex items-center gap-4">
                            {replaceState[i] === "replaced" ? (
                              <span className="text-[11px] font-semibold text-success">Replaced &#10003;</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReplace(i, issue.original, issue.suggestion)}
                                className="cursor-pointer text-[11px] font-semibold text-primary hover:underline"
                              >
                                Replace
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(issue.suggestion)}
                              className="cursor-pointer text-[11px] font-semibold text-primary hover:underline"
                            >
                              Copy suggestion
                            </button>
                          </div>
                          {replaceState[i] === "missing" && (
                            <p className="mt-1.5 text-[11px] text-warning">
                              Couldn&apos;t find this text &mdash; it may have been edited already.
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setShowWritingCheck(false)}>
                Close
              </Button>
              <Button className="flex-1" onClick={handleCheckWriting} disabled={checking}>
                Check again
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Submit panel (overlay) */}
      {showSubmitPanel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowSubmitPanel(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={draftStatus === "changes_requested" ? "Resubmit for Editorial Review" : "Submit for Editorial Review"}
            className="fixed inset-y-0 right-0 z-50 flex w-[min(420px,90vw)] flex-col overflow-y-auto border-l border-line bg-bg-secondary p-6 shadow-card"
          >
            <h3 className="mb-6 font-heading text-lg font-bold text-text-main">
              {draftStatus === "changes_requested" ? "Resubmit for Editorial Review" : "Submit for Editorial Review"}
            </h3>

            {/* Title & excerpt */}
            <div className="mb-5">
              <div className="mb-1.5 flex items-center justify-between">
                <label className={formLabel}>Excerpt</label>
                <button
                  type="button"
                  onClick={handleSuggestTitleExcerpt}
                  disabled={suggesting || wordCount === 0}
                  className="cursor-pointer text-[11px] font-semibold text-primary hover:underline disabled:cursor-default disabled:opacity-50 disabled:no-underline"
                >
                  {suggesting ? "Thinking..." : "Suggest title & excerpt with AI"}
                </button>
              </div>
              <textarea
                className={cn(formControl, "min-h-[72px] resize-y")}
                value={excerpt}
                maxLength={MAX_EXCERPT}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="A one or two sentence teaser shown on article cards. Leave blank to use the start of your article."
              />
              <p className="mt-1 text-right text-[11px] text-text-muted">
                {excerpt.length}/{MAX_EXCERPT}
              </p>

              {suggestError && !suggesting && <p className="mt-1 text-[12px] text-danger">{suggestError}</p>}

              {excerptSuggestion && (
                <div className="mt-2 rounded-lg border border-line bg-bg-primary p-3">
                  <p className="text-[10px] font-bold tracking-wide text-primary uppercase">AI excerpt suggestion</p>
                  <p className="mt-1 text-[12.5px] text-text-main">{excerptSuggestion}</p>
                  <button
                    type="button"
                    onClick={() => setExcerpt(excerptSuggestion)}
                    className="mt-2 cursor-pointer text-[11px] font-semibold text-primary hover:underline"
                  >
                    Use this
                  </button>
                </div>
              )}

              {titleOptions.length > 0 && (
                <div className="mt-2 rounded-lg border border-line bg-bg-primary p-3">
                  <p className="text-[10px] font-bold tracking-wide text-primary uppercase">AI title options</p>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {titleOptions.map((option) => (
                      <li key={option}>
                        <button
                          type="button"
                          onClick={() => handleTitleChange(option)}
                          className={cn(
                            "w-full cursor-pointer rounded-md border px-2.5 py-1.5 text-left text-[12.5px] text-text-main hover:bg-surface-hover",
                            option === title ? "border-primary bg-primary-glow" : "border-line",
                          )}
                        >
                          {option}
                          {option === title && <span className="ml-2 text-[11px] font-semibold text-primary">Current title</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[11px] text-text-muted">Click a title to use it. You can still edit it above the editor.</p>
                </div>
              )}
            </div>

            {/* Search metadata (SEO) */}
            <div className="mb-5">
              <div className="mb-1.5 flex items-center justify-between">
                <label className={formLabel}>Search &amp; sharing (optional)</label>
                <button
                  type="button"
                  onClick={handleSuggestSeo}
                  disabled={seoSuggesting || wordCount === 0}
                  className="cursor-pointer text-[11px] font-semibold text-primary hover:underline disabled:cursor-default disabled:opacity-50 disabled:no-underline"
                >
                  {seoSuggesting ? "Thinking..." : "Suggest with AI"}
                </button>
              </div>
              <input
                type="text"
                className={formControl}
                value={seoTitle}
                maxLength={SEO_TITLE_MAX}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Search title (defaults to your article title)"
              />
              <p className="mt-1 mb-2 text-right text-[11px] text-text-muted">
                {seoTitle.length}/{SEO_TITLE_MAX}
              </p>
              <textarea
                className={cn(formControl, "min-h-[64px] resize-y")}
                value={seoDescription}
                maxLength={SEO_DESCRIPTION_MAX}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Description shown in search results and link previews"
              />
              <p className="mt-1 mb-2 text-right text-[11px] text-text-muted">
                {seoDescription.length}/{SEO_DESCRIPTION_MAX}
              </p>
              <input
                type="text"
                className={formControl}
                value={seoKeywords}
                onChange={(e) => setSeoKeywords(e.target.value)}
                placeholder="Keywords, separated by commas"
              />

              {seoError && !seoSuggesting && <p className="mt-1.5 text-[12px] text-danger">{seoError}</p>}

              {seoSuggestion && (
                <div className="mt-2 rounded-lg border border-line bg-bg-primary p-3">
                  <p className="text-[10px] font-bold tracking-wide text-primary uppercase">AI suggestion</p>
                  <p className="mt-1.5 text-[12.5px] font-semibold text-text-main">{seoSuggestion.title}</p>
                  <p className="mt-1 text-[12px] text-text-main">{seoSuggestion.description}</p>
                  <p className="mt-1 text-[11px] text-text-muted">{seoSuggestion.keywords.join(", ")}</p>
                  <button
                    type="button"
                    onClick={useSeoSuggestion}
                    className="mt-2 cursor-pointer text-[11px] font-semibold text-primary hover:underline"
                  >
                    Use these
                  </button>
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-text-muted">
                Used for the page title and description when your article is shared or listed. Leave blank to use your title and excerpt.
              </p>
            </div>

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
              <div className="mb-1.5 flex items-center justify-between">
                <label className={formLabel}>
                  Tags ({selectedTags.length}/{MAX_TAGS})
                </label>
                <button
                  type="button"
                  onClick={handleSuggestTags}
                  disabled={tagSuggesting || wordCount === 0}
                  className="cursor-pointer text-[11px] font-semibold text-primary hover:underline disabled:cursor-default disabled:opacity-50 disabled:no-underline"
                >
                  {tagSuggesting ? "Thinking..." : "Suggest tags with AI"}
                </button>
              </div>
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

              {tagSuggestError && !tagSuggesting && <p className="mt-1.5 text-[12px] text-danger">{tagSuggestError}</p>}

              {tagSuggestion && (
                <div className="mt-2 rounded-lg border border-line bg-bg-primary p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold tracking-wide text-primary uppercase">AI tag suggestions</p>
                    <button
                      type="button"
                      onClick={addAllSuggestedTags}
                      disabled={selectedTags.length >= MAX_TAGS}
                      className="cursor-pointer text-[11px] font-semibold text-primary hover:underline disabled:cursor-default disabled:opacity-50 disabled:no-underline"
                    >
                      Add all
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tagSuggestion.tags.map(({ name, existing }) => {
                      const added = selectedTags.some((t) => t.toLowerCase() === name.toLowerCase());
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => addTag(name)}
                          disabled={added || selectedTags.length >= MAX_TAGS}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                            added
                              ? "border-success/40 bg-success/10 text-success"
                              : "cursor-pointer border-line bg-bg-secondary text-text-main hover:bg-surface-hover disabled:cursor-default disabled:opacity-50",
                          )}
                        >
                          {added ? "✓" : "+"} {name}
                          {!existing && <span className="text-[10px] font-normal text-text-muted">new</span>}
                        </button>
                      );
                    })}
                  </div>
                  {tagSuggestion.contentType !== contentType && (
                    <p className="mt-2 text-[11px] text-text-muted">
                      Suggested content type: <strong className="text-text-main">{tagSuggestion.contentType}</strong>{" "}
                      <button
                        type="button"
                        onClick={() => setContentType(tagSuggestion.contentType)}
                        className="cursor-pointer font-semibold text-primary hover:underline"
                      >
                        Use this
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Licence */}
            <div className="mb-5">
              <label className={formLabel}>Content licence</label>
              <select className={formControl} value={license} onChange={(e) => setLicense(e.target.value)}>
                {LICENSE_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-text-muted">
                Shown publicly on your article and recorded in its content credential.
              </p>
            </div>

            {/* Destination */}
            <div className="mb-5">
              <label className={formLabel}>Where should this go once approved?</label>
              <div className="flex flex-col gap-2">
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border p-3",
                    destination === "main_app" ? "border-primary bg-primary-glow" : "border-line bg-bg-primary",
                  )}
                >
                  <input
                    type="radio"
                    name="destination"
                    checked={destination === "main_app"}
                    onChange={() => setDestination("main_app")}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span className="text-[12.5px] text-text-main">
                    MYHitch Main App
                    <span className="mt-0.5 block text-[11px] text-text-muted">
                      Publish normally once approved — for your own marketing and reach.
                    </span>
                  </span>
                </label>
                {profile.canSponsor && (
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-lg border p-3",
                      destination === "exchange_hub" ? "border-primary bg-primary-glow" : "border-line bg-bg-primary",
                    )}
                  >
                    <input
                      type="radio"
                      name="destination"
                      checked={destination === "exchange_hub"}
                      onChange={() => setDestination("exchange_hub")}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span className="text-[12.5px] text-text-main">
                      Exchange Hub
                      <span className="mt-0.5 block text-[11px] text-text-muted">
                        Hold for a sponsor before publishing — submit the opportunity from Exchange Hub after this is approved.
                      </span>
                    </span>
                  </label>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-text-muted">
                {profile.canSponsor
                  ? "Your editor sees this choice — you can still switch to the Exchange Hub later from an unpublished article."
                  : "Sponsored articles through the Exchange Hub aren't included in your plan."}
              </p>
            </div>

            {/* Rights attestation */}
            <div className="mb-6 rounded-lg border border-warning/30 bg-warning/5 p-4">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={rightsAttested}
                  onChange={(e) => setRightsAttested(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span className="text-[12px] text-text-main">
                  I own — or am licensed for — all text and media in this article, and it doesn’t infringe anyone’s copyright.
                  <span className="mt-1 block text-[11px] text-text-muted">
                    Uploaded media must carry no third-party logos or watermarks. On publication a signed content credential is minted; false claims can lead to takedown.
                  </span>
                </span>
              </label>
            </div>

            {/* Pre-submit checklist */}
            <div className="mb-6 rounded-lg border border-line bg-bg-primary p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-main">Pre-submit check</span>
                <button
                  type="button"
                  onClick={handleRunChecklist}
                  disabled={checklistRunning}
                  className="cursor-pointer text-[11px] font-semibold text-primary hover:underline disabled:cursor-default disabled:opacity-60 disabled:no-underline"
                >
                  {checklistRunning ? "Checking..." : checklist ? "Run again" : "Run check"}
                </button>
              </div>
              {!checklist && !checklistError && !checklistRunning && (
                <p className="mt-1.5 text-[11px] text-text-muted">
                  Checks your article against the submission rules and your plan, and reviews the content before editors see it.
                </p>
              )}
              {checklistError && !checklistRunning && <p className="mt-2 text-[12px] text-danger">{checklistError}</p>}
              {checklist && !checklistRunning && (
                <>
                  <p className="mt-1.5 text-[11px] text-text-muted">
                    {checklist.filter((i) => i.status === "fail").length} to fix &middot;{" "}
                    {checklist.filter((i) => i.status === "warn").length} to review &middot;{" "}
                    {checklist.filter((i) => i.status === "pass").length} passed
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {[...checklist]
                      .sort((a, b) => ({ fail: 0, warn: 1, pass: 2 })[a.status] - ({ fail: 0, warn: 1, pass: 2 })[b.status])
                      .map((item) => (
                        <li key={item.id} className="flex gap-2 text-[12.5px]">
                          <span
                            aria-hidden
                            className={cn(
                              "mt-px w-4 shrink-0 text-center font-bold",
                              item.status === "pass" && "text-success",
                              item.status === "warn" && "text-warning",
                              item.status === "fail" && "text-danger",
                            )}
                          >
                            {item.status === "pass" ? "✓" : item.status === "warn" ? "!" : "✕"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-text-main">
                              <span className="sr-only">{item.status === "pass" ? "Passed: " : item.status === "warn" ? "Review: " : "Fix: "}</span>
                              {item.label}
                            </p>
                            {item.detail && <p className="text-[11px] text-text-muted">{item.detail}</p>}
                            {item.notes && (
                              <ul className="mt-1 flex flex-col gap-1">
                                {item.notes.map((note, i) => (
                                  <li key={i} className="rounded border border-line bg-bg-secondary px-2 py-1 text-[11px] text-text-muted">
                                    {note}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>
                </>
              )}
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
              {outOfSubmissions && (
                <p className="mb-3 w-full text-[12.5px] text-danger">
                  You&apos;ve used all {profile.allowance.limit} article submissions your plan includes this month. They reset on
                  the 1st; upgrade your package in My Profile to submit more now.
                </p>
              )}
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
                disabled={isSubmitting || outOfSubmissions || !title.trim() || selectedTags.length === 0 || !rightsAttested}
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
