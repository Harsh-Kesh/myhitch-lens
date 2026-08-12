"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import {
  formControl,
  formControlSm,
  formLabel,
  workspacePanel,
} from "@/components/ui/Form";
import {
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  LinkIcon,
  ListIcon,
  MicIcon,
  MusicIcon,
  BarChartIcon,
  FilmIcon,
  ShieldIcon,
  StarBurstIcon,
  UploadIcon,
} from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import {
  getQueue,
  getUserName,
  getUserRole,
  pushNotification,
  saveQueue,
} from "@/lib/lensStore";
import { cn } from "@/lib/cn";
import { CATEGORY_NAMES } from "@/data/categories";
import type { QueueItem } from "@/lib/types";

/** All 11 canonical categories (single source of truth). */
const CATEGORIES = CATEGORY_NAMES;

const CONTENT_TYPES = [
  { value: "Blog", label: "Blog Post" },
  { value: "News", label: "News" },
  { value: "Report", label: "Report / Industry Whitepaper" },
  { value: "Research Paper", label: "Research Paper" },
];

const LANGUAGES = [
  { value: "es", label: "Spanish (Español)" },
  { value: "fr", label: "French (Français)" },
  { value: "de", label: "German (Deutsch)" },
  { value: "zh", label: "Chinese (中文)" },
];

const DEFAULT_TITLE = "The Impact of AI in Modern Supply Chain Operations";

const DEFAULT_BODY = `The global logistics market is experiencing an unprecedented structural shift. Artificial Intelligence (AI) algorithms are changing how warehouses optimize inventory, predictive route optimization models are curbing carbon emissions, and automated document ingestion is eliminating manual customs clearing friction.

By analyzing telemetry data, modern supply chains are moving from responsive patterns to predictive modeling, allowing logistics fleets to bypass delays before they occur.

In this research, we review three main pillars:
1. Automated forecasting accuracy using deep neural networks.
2. Multi-tier supplier risk calculations.
3. Fleet scheduling dynamic overrides.

We conclude that businesses adopting these integrated pipelines realize up to a 14% reductions in inventory carrying costs.`;

/** `.toolbar-btn` - sized to clear a 24px touch target on phones. */
const toolbarBtn =
  "min-h-6 min-w-6 cursor-pointer rounded border-none bg-transparent px-2 py-1 text-[13px] text-text-muted transition-all duration-200 hover:bg-surface-hover hover:text-text-main";

/** `.ai-pill-btn` */
const aiPillBtn =
  "flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-bg-primary px-3.5 py-2.5 text-left font-body text-[12.5px] font-[550] text-text-main transition-all duration-200 hover:translate-x-1 hover:border-primary hover:bg-surface-hover";

/** `.insight-stat` */
const insightStat =
  "rounded-lg border border-line bg-bg-primary p-3 text-center";

const aiHeading = "mb-2 flex items-center gap-1.5 font-bold";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function SubmitPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [category, setCategory] = useState("Supply Chain");
  const [contentType, setContentType] = useState("Research Paper");
  const [body, setBody] = useState(DEFAULT_BODY);

  const [draftStatus, setDraftStatus] = useState("Draft Saved");
  const [plagiarismScore, setPlagiarismScore] = useState("--");
  const [seoRating, setSeoRating] = useState("--");
  const [aiOutput, setAiOutput] = useState<ReactNode>(null);
  const [translateLang, setTranslateLang] = useState(LANGUAGES[0].value);

  const words = countWords(body);
  const readingTime = Math.max(1, Math.ceil(words / 150));

  /** Renders the "AI is thinking" state, then the result after `delay` ms. */
  function runAiTask(pending: string, delay: number, result: ReactNode) {
    setAiOutput(
      <div className="flex h-full flex-col items-center justify-center pt-5 text-primary">
        <p className="text-xs">{pending}</p>
      </div>,
    );
    setTimeout(() => setAiOutput(result), delay);
  }

  function runAiCheck() {
    runAiTask(
      "AI is scanning document patterns...",
      1000,
      <div className="text-[12.5px]">
        <h5 className={cn(aiHeading, "text-success")}>
          <ShieldIcon className="size-3.5" /> AI Verification Assessment Passed
        </h5>
        <p className="mb-1.5">
          <strong>Plagiarism Scan:</strong> 99.4% Unique content (0.6% standard technical
          phrases matched).
        </p>
        <p className="mb-1.5">
          <strong>Grammar &amp; Style:</strong> 0 alerts. Readability rating fits target
          demographics.
        </p>
      </div>,
    );
    setTimeout(() => setPlagiarismScore("99.4%"), 1000);
  }

  function generateAiSummary() {
    runAiTask(
      "AI summarizing draft body...",
      1000,
      <div className="text-[12.5px]">
        <h5 className={cn(aiHeading, "text-primary")}>
          <FileTextIcon className="size-3.5" /> AI Generated Abstract Summary
        </h5>
        <p className="mb-2.5 rounded-md border border-line bg-bg-secondary p-2 italic">
          &quot;This paper reviews key transformations inside modern logistics corridors,
          discussing forecasting networks, risk indexing, and carbon emission
          reductions.&quot;
        </p>
      </div>,
    );
  }

  function optimizeSeo() {
    runAiTask(
      "AI executing semantic search analysis...",
      1000,
      <div className="text-[12.5px]">
        <h5 className={cn(aiHeading, "text-success")}>
          <BarChartIcon className="size-3.5" /> SEO Analytics Optimization
        </h5>
        <p className="mb-1.5">
          <strong>Suggested Title:</strong> &quot;Leveraging Predictive AI in Global
          Supply Chain Clusters&quot; (increases search index rating by +18%)
        </p>
        <p className="mb-2">
          <strong>Recommended Keywords tags:</strong>{" "}
          <span className="rounded-[10px] bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white">
            AI Logistics
          </span>{" "}
          <span className="rounded-[10px] bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white">
            Supply Chain
          </span>
        </p>
        <p>
          <strong>Readability Index:</strong> 85/100 (Excellent for Executive teams).
        </p>
      </div>,
    );
    setTimeout(() => setSeoRating("A+"), 1000);
  }

  function executeTranslation() {
    const label =
      LANGUAGES.find((option) => option.value === translateLang)?.label ?? "";
    runAiTask(
      `Translating entire corpus into ${label}...`,
      1200,
      <div className="text-[12.5px]">
        <h5 className={cn(aiHeading, "text-success")}>
          <GlobeIcon className="size-3.5" /> Draft Translation Completed
        </h5>
        <p className="mb-2 rounded border border-line bg-bg-secondary p-1.5 text-xs italic">
          &quot;Las operaciones logísticas globales están experimentando un cambio
          estructural sin precedentes...&quot;
        </p>
      </div>,
    );
  }

  function runAiTranslation() {
    setAiOutput(
      <div className="text-[12.5px]">
        <h5 className={cn(aiHeading, "mb-3 text-accent")}>
          <GlobeIcon className="size-3.5" /> Translate Document Draft
        </h5>
        <div className="mb-5">
          <label htmlFor="translateLangSelector" className={formLabel}>
            Target Language
          </label>
          <select
            id="translateLangSelector"
            className={formControlSm}
            defaultValue={translateLang}
            onChange={(event) => setTranslateLang(event.target.value)}
          >
            {LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" className="w-full" onClick={executeTranslation}>
          Translate Now
        </Button>
      </div>,
    );
  }

  function generateVoiceNarration() {
    runAiTask(
      "AI voice synthesis is generating audio variant...",
      1000,
      <div className="text-[12.5px]">
        <h5 className={cn(aiHeading, "text-success")}>
          <MicIcon className="size-3.5" /> AI Voice Narration Generated
        </h5>
        <p className="mb-2.5">
          Audio waveform synthesized successfully using{" "}
          <strong>Neural Voice: Male Accent 2</strong>.
        </p>
      </div>,
    );
  }

  function saveDraft() {
    setDraftStatus("Saving...");
    setTimeout(() => {
      setDraftStatus("Draft Saved");
      alert(`"${title}" saved successfully to drafts list.`);
    }, 500);
  }

  function submitToWorkflow() {
    if (!title.trim() || !body.trim()) {
      alert("Please fill in the headline and article body.");
      return;
    }

    const submission: QueueItem = {
      id: `rev-${Date.now()}`,
      title,
      author: getUserName(),
      authorRank:
        getUserRole() === "author" ? "Silver Contributor" : "Contributor",
      category,
      type: contentType,
      submittedDate: `2026-07-20 ${new Date()
        .toTimeString()
        .split(" ")[0]
        .substring(0, 5)}`,
      aiScore: Math.floor(Math.random() * 10) + 89,
      plagiarism: "0.4% detected",
      readability: "Good (Flesch: 65)",
      sentiment: "Highly Analytical",
      content: body,
    };

    const queue = getQueue();
    queue.push(submission);
    saveQueue(queue);

    pushNotification(`Submitted "${title}" for editorial vetting.`);

    alert(
      `"${title}" successfully submitted to the review queue!\nRedirecting to portfolio...`,
    );
    router.push("/author-dashboard");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setTitle(
      file.name
        .replace(/\.[^/.]+$/, "")
        .split("_")
        .join(" ")
        .replace(/\b\w/g, (character) => character.toUpperCase()),
    );
    setBody(
      `[PARSED RESEARCH CORPUS: ${file.name}]\nDocument parsed and structured successfully via PDF/Word telemetry parser modules.\n\nType findings here or click AI tools to run assessments...`,
    );
    alert(`Parsed file: ${file.name}!`);
  }

  return (
    <>
      <ViewHeader
        title="Article Submission"
        subtitle="Draft articles, load files, and perform AI quality reviews before submitting."
        actions={
          <div className="text-xs font-semibold">
            <span className="rounded bg-primary-glow px-2.5 py-1 text-warning">
              {draftStatus}
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-[1.3fr_0.7fr] gap-[30px] max-[992px]:grid-cols-1">
        {/* Text Editor */}
        <div className={workspacePanel}>
          <div className="mb-5">
            <label htmlFor="articleTitle" className={formLabel}>
              Article Title
            </label>
            <input
              id="articleTitle"
              type="text"
              className={formControl}
              placeholder="Enter article headline..."
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="mb-5 flex-[0_0_calc(50%-8px)] max-[560px]:mb-0 max-[560px]:flex-[1_1_100%]">
              <label htmlFor="articleCategory" className={formLabel}>
                Category
              </label>
              <select
                id="articleCategory"
                className={formControl}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-5 flex-[0_0_calc(50%-8px)] max-[560px]:flex-[1_1_100%]">
              <label htmlFor="articleType" className={formLabel}>
                Content Type
              </label>
              <select
                id="articleType"
                className={formControl}
                value={contentType}
                onChange={(event) => setContentType(event.target.value)}
              >
                {CONTENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Editor Toolbar Mock - `.editor-toolbar` */}
          <div className="flex flex-wrap items-center gap-2 rounded-t-lg border border-b-0 border-line bg-bg-tertiary px-4 py-2">
            <button
              type="button"
              className={cn(toolbarBtn, "font-bold")}
              onClick={() => alert("Formatting triggered: Bold")}
            >
              B
            </button>
            <button
              type="button"
              className={cn(toolbarBtn, "italic")}
              onClick={() => alert("Formatting triggered: Italic")}
            >
              I
            </button>
            <button
              type="button"
              className={cn(toolbarBtn, "underline")}
              onClick={() => alert("Formatting triggered: Underline")}
            >
              U
            </button>
            <button
              type="button"
              className={toolbarBtn}
              onClick={() => alert("Formatting triggered: Inline Code")}
            >
              &lt;&gt;
            </button>
            <button
              type="button"
              className={toolbarBtn}
              onClick={() => alert("Formatting triggered: Block Quote")}
            >
              ”
            </button>
            <button
              type="button"
              className={cn(toolbarBtn, "inline-flex items-center justify-center")}
              onClick={() => alert("Formatting triggered: Anchor Link")}
            >
              <LinkIcon className="size-3.5" />
            </button>
            <button
              type="button"
              className={cn(toolbarBtn, "inline-flex items-center justify-center")}
              onClick={() => alert("Formatting triggered: Bullets")}
            >
              <ListIcon className="size-3.5" />
            </button>

            {/* `.toolbar-separator` */}
            <div className="mx-1 h-4 w-px bg-line" />

            <button
              type="button"
              className={cn(toolbarBtn, "inline-flex items-center gap-1")}
              onClick={() => alert("Asset insertion: Embed Image")}
            >
              <ImageIcon className="size-3.5" /> Image
            </button>
            <button
              type="button"
              className={cn(toolbarBtn, "inline-flex items-center gap-1")}
              onClick={() => alert("Asset insertion: Embed Nexus Video")}
            >
              <FilmIcon className="size-3.5" /> Video
            </button>
            <button
              type="button"
              className={cn(toolbarBtn, "inline-flex items-center gap-1")}
              onClick={() => alert("Asset insertion: Embed Audio Narration")}
            >
              <MusicIcon className="size-3.5" /> Audio
            </button>
          </div>

          {/* Text Area - `.editor-textarea` */}
          <div className="mb-5">
            <textarea
              id="articleContent"
              rows={15}
              className={cn(formControl, "resize-y rounded-t-none leading-[1.7]")}
              placeholder="Write your publication content here..."
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          {/* Document Dropzone - `.upload-dropzone` */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="mb-6 cursor-pointer rounded-lg border-2 border-dashed border-line bg-[rgba(0,0,0,0.2)] p-[30px] text-center transition-colors duration-200 hover:border-primary max-[480px]:p-5"
          >
            <UploadIcon className="mx-auto mb-3 size-9 text-text-muted" />
            <p className="mb-1 text-[13.5px]">
              <strong>Drag &amp; Drop</strong> your Research Word doc or PDF, or{" "}
              <span className="font-semibold text-primary underline">browse files</span>
            </p>
            <span className="block text-[11px] text-text-muted">
              Max size 25MB (Formats: .pdf, .docx, .txt)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
            />
          </div>

          {/* `.editor-actions` */}
          <div className="flex flex-wrap justify-end gap-3 max-[480px]:flex-col-reverse">
            <Button variant="secondary" onClick={saveDraft}>
              Save Draft
            </Button>
            <Button onClick={submitToWorkflow}>Submit for Editorial Review</Button>
          </div>
        </div>

        {/* AI Assistant Floating Sidebar */}
        <div className="flex flex-col gap-6">
          {/* `.sidebar-card` */}
          <div className="overflow-hidden rounded-xl border border-line bg-bg-secondary">
            {/* `.card-header-ai` */}
            <div className="flex items-center gap-2.5 bg-[linear-gradient(135deg,var(--primary-color)_0%,var(--accent-color)_100%)] px-5 py-4 text-white">
              <StarBurstIcon className="size-5 animate-pulse-glow text-white" />
              <h4 className="font-heading text-[15px] font-bold text-white">
                AI Writing Assistant
              </h4>
            </div>

            <div className="p-5">
              <div className="mb-5 flex flex-col gap-2.5">
                <button type="button" className={aiPillBtn} onClick={runAiCheck}>
                  <ShieldIcon className="size-3.5 shrink-0" /> Grammar &amp; Plagiarism
                  Check
                </button>
                <button type="button" className={aiPillBtn} onClick={generateAiSummary}>
                  <FileTextIcon className="size-3.5 shrink-0" /> Generate Abstract
                  Summary
                </button>
                <button type="button" className={aiPillBtn} onClick={optimizeSeo}>
                  <BarChartIcon className="size-3.5 shrink-0" /> SEO &amp; Tag
                  Recommendation
                </button>
                <button type="button" className={aiPillBtn} onClick={runAiTranslation}>
                  <GlobeIcon className="size-3.5 shrink-0" /> Translate Draft
                </button>
                <button
                  type="button"
                  className={aiPillBtn}
                  onClick={generateVoiceNarration}
                >
                  <MicIcon className="size-3.5 shrink-0" /> Generate Voice Narration
                </button>
              </div>

              {/* Dynamic Output Panel - `.ai-output-box` */}
              <div className="max-h-[240px] min-h-[180px] overflow-y-auto rounded-lg border border-line bg-bg-primary p-4 text-[13px] leading-[1.5]">
                {aiOutput ?? (
                  <div className="pt-10 text-center text-text-muted">
                    <p>
                      Select an AI task from the panel above to run optimizations on your
                      draft.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Draft Stats - `.stats-panel` */}
          <div className="rounded-xl border border-line bg-bg-secondary p-6">
            <h4 className="mb-4 font-heading text-sm leading-[1.25] font-bold text-text-muted uppercase">
              Draft Insights
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className={insightStat}>
                <span className="block text-lg font-extrabold">{words}</span>
                <span className="text-[11px] text-text-muted uppercase">Words</span>
              </div>
              <div className={insightStat}>
                <span className="block text-lg font-extrabold">{readingTime} min</span>
                <span className="text-[11px] text-text-muted uppercase">Read Time</span>
              </div>
              <div className={insightStat}>
                <span
                  className={cn(
                    "block text-lg font-extrabold",
                    plagiarismScore !== "--" && "text-success",
                  )}
                >
                  {plagiarismScore}
                </span>
                <span className="text-[11px] text-text-muted uppercase">Plagiarism</span>
              </div>
              <div className={insightStat}>
                <span
                  className={cn(
                    "block text-lg font-extrabold",
                    seoRating !== "--" && "text-success",
                  )}
                >
                  {seoRating}
                </span>
                <span className="text-[11px] text-text-muted uppercase">SEO Score</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
