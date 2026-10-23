"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { prepareImport, type PreparedImport } from "@/lib/importHtml";

// Keep in sync with EXTENSIONS and MAX_IMPORT_BYTES in lib/documentImport.ts.
export const IMPORT_ACCEPT = ".docx,.pdf,.md,.markdown,.html,.htm,.txt,.jpg,.jpeg,.png,.webp,.gif";
const MAX_BYTES = 20 * 1024 * 1024;
const SUPPORTED = new Set(IMPORT_ACCEPT.replace(/\./g, "").split(","));
const AI_READ = new Set(["pdf", "jpg", "jpeg", "png", "webp", "gif"]);

export type ImportApply = { html: string; title: string | null; mode: "replace" | "append" };

type ApiResult = { html: string; warnings: string[]; aiRead: boolean; kind: string };

type Step =
  | { name: "choose"; error?: string }
  | { name: "reading"; file: File }
  | { name: "review"; file: File; result: ApiResult; prepared: PreparedImport };

const extOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";

function problemWith(file: File): string | null {
  const ext = extOf(file.name);
  if (["doc", "rtf", "odt", "pages"].includes(ext)) {
    return `.${ext} files can't be read without losing their layout. Save or export it as Word (.docx) or PDF from your word processor, then import that.`;
  }
  if (!SUPPORTED.has(ext)) return "That file type isn't supported. Use Word, PDF, Markdown, HTML, plain text or an image.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_BYTES) return `That file is too large. The limit is ${MAX_BYTES / 1024 / 1024} MB.`;
  return null;
}

/** Drag-and-drop target that also opens the file picker. */
export function ImportDropzone({ onFile, className }: { onFile: (file: File) => void; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
        over ? "border-primary bg-primary-glow" : "border-line bg-bg-primary hover:border-primary/60 hover:bg-surface-hover",
        className,
      )}
    >
      <svg className="size-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p className="text-[13px] font-semibold text-text-main">Drag and drop your document here, or click to browse</p>
      <p className="text-[11.5px] text-text-muted">
        Word (.docx), PDF, Markdown, HTML, text, or a photo or scan of a page (JPG, PNG, WebP, GIF). Up to 20 MB.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

export function ImportDocumentModal({
  initialFile,
  hasContent,
  titleEmpty,
  onApply,
  onClose,
}: {
  initialFile?: File | null;
  /** The editor already has text, so the author chooses between replacing it and adding to it. */
  hasContent: boolean;
  /** Only an empty title field takes the document's title; otherwise the title stays in the text. */
  titleEmpty: boolean;
  onApply: (apply: ImportApply) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [mode, setMode] = useState<"replace" | "append">(hasContent ? "append" : "replace");
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const readFile = useCallback(
    async (file: File) => {
      const problem = problemWith(file);
      if (problem) return setStep({ name: "choose", error: problem });

      setStep({ name: "reading", file });
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/import", { method: "POST", body, signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return setStep({ name: "choose", error: data.error || "The document couldn't be imported. Please try again." });
        const result = data as ApiResult;
        const prepared = prepareImport(result.html, { takeTitle: titleEmpty });
        if (prepared.stats.words === 0 && prepared.stats.images === 0) {
          return setStep({ name: "choose", error: "No text could be found in that file." });
        }
        setStep({ name: "review", file, result, prepared });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setStep({ name: "choose", error: "The document couldn't be imported. Check your connection and try again." });
      }
    },
    [titleEmpty],
  );

  // A file dropped on the page arrives already chosen.
  useEffect(() => {
    if (initialFile && !startedRef.current) {
      startedRef.current = true;
      void readFile(initialFile);
    }
  }, [initialFile, readFile]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const reading = step.name === "reading" ? step.file : null;
  const slow = reading ? AI_READ.has(extOf(reading.name)) : false;

  return (
    <Modal onClose={onClose} className="w-[min(560px,92vw)]">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-heading text-lg font-bold text-text-main">Import a document</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer text-xl leading-none text-text-muted hover:text-text-main">
          &times;
        </button>
      </div>
      <p className="mb-4 text-[12px] text-text-muted">
        Bring in something you wrote elsewhere. The headings, paragraphs, lists, tables and images keep the structure of your original.
      </p>

      {step.name === "choose" && (
        <>
          {step.error && <p className="mb-3 rounded-lg border border-danger/40 bg-danger/5 p-3 text-[12.5px] text-danger">{step.error}</p>}
          <ImportDropzone onFile={readFile} />
          <p className="mt-3 text-[11px] text-text-muted">
            A photo or scan is read for its text. A picture with no text is added as an image. Google Docs and Pages: use File &gt; Download or Export as Word or PDF first.
          </p>
        </>
      )}

      {step.name === "reading" && (
        <div className="rounded-lg border border-line bg-bg-primary p-5 text-center">
          <p className="text-[13px] font-semibold text-text-main">Reading {step.file.name}...</p>
          <p className="mt-1 text-[11.5px] text-text-muted">
            {slow ? "The AI is reading every page, so a long document can take a minute or two." : "This only takes a moment."}
          </p>
        </div>
      )}

      {step.name === "review" && (
        <>
          <div className="rounded-lg border border-line bg-bg-primary p-4">
            <p className="truncate text-[13px] font-semibold text-text-main">{step.file.name}</p>
            <p className="mt-1 text-[12px] text-text-muted">
              {[
                `${step.prepared.stats.words.toLocaleString()} words`,
                step.prepared.stats.headings && `${step.prepared.stats.headings} heading${step.prepared.stats.headings === 1 ? "" : "s"}`,
                step.prepared.stats.paragraphs && `${step.prepared.stats.paragraphs} paragraph${step.prepared.stats.paragraphs === 1 ? "" : "s"}`,
                step.prepared.stats.lists && `${step.prepared.stats.lists} list${step.prepared.stats.lists === 1 ? "" : "s"}`,
                step.prepared.stats.tables && `${step.prepared.stats.tables} table${step.prepared.stats.tables === 1 ? "" : "s"}`,
                step.prepared.stats.images && `${step.prepared.stats.images} image${step.prepared.stats.images === 1 ? "" : "s"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {step.prepared.title && (
              <p className="mt-2 text-[12px] text-text-main">
                <span className="text-text-muted">Title for your article: </span>
                <strong>{step.prepared.title}</strong>
              </p>
            )}
          </div>

          {step.result.aiRead && (
            <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-[12px] text-warning">
              This file was read by AI. It copies what&apos;s on the page, but check the result against your original before you submit.
            </p>
          )}
          {step.result.warnings.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {step.result.warnings.map((w) => (
                <li key={w} className="rounded-lg border border-line bg-bg-primary p-2.5 text-[12px] text-text-muted">
                  {w}
                </li>
              ))}
            </ul>
          )}

          {hasContent && (
            <fieldset className="mt-4 flex flex-col gap-2">
              <legend className="mb-1.5 text-xs font-semibold text-text-muted">Your editor already has text</legend>
              {(
                [
                  ["append", "Add to the end", "Keeps what you've written and puts the document below it."],
                  ["replace", "Replace what's there", "Swaps your current text for the document. You can undo this with Ctrl+Z."],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border p-3",
                    mode === value ? "border-primary bg-primary-glow" : "border-line bg-bg-primary",
                  )}
                >
                  <input type="radio" name="import-mode" checked={mode === value} onChange={() => setMode(value)} className="mt-0.5 size-4 accent-primary" />
                  <span className="text-[12.5px] text-text-main">
                    {label}
                    <span className="mt-0.5 block text-[11px] text-text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <div className="mt-5 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep({ name: "choose" })}>
              Choose another
            </Button>
            <Button
              className="flex-1"
              onClick={() => onApply({ html: step.prepared.html, title: step.prepared.title, mode: hasContent ? mode : "replace" })}
            >
              Add to article
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
