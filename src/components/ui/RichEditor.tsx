"use client";

import {
  useEditor,
  EditorContent,
  Node,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { licenseShort } from "@/lib/licenses";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { getMagazinePlacement } from "@/app/(portal)/magazine/publicActions";

// ---------------------------------------------------------------------------
// Media node: resizable image / video with caption + source reference
// ---------------------------------------------------------------------------

type Align = "left" | "center" | "right";

interface MediaAttrs {
  src: string | null;
  alt: string;
  caption: string;
  sourceUrl: string;
  sourceLabel: string;
  showSource: boolean;
  width: number; // percentage of the column width
  align: Align;
  aspect: string | null; // e.g. "16 / 9", null = original
}

const WIDTH_PRESETS = [
  { label: "S", value: 30, title: "Small (30%)" },
  { label: "M", value: 50, title: "Medium (50%)" },
  { label: "L", value: 75, title: "Large (75%)" },
  { label: "Full", value: 100, title: "Full width" },
];

const ASPECT_PRESETS = [
  { label: "Orig", value: null, title: "Original ratio" },
  { label: "16:9", value: "16 / 9", title: "Crop to 16:9" },
  { label: "4:3", value: "4 / 3", title: "Crop to 4:3" },
  { label: "1:1", value: "1 / 1", title: "Crop to square" },
];

function MediaNodeView(props: NodeViewProps) {
  const { node, updateAttributes, selected, editor } = props;
  const attrs = node.attrs as MediaAttrs;
  const kind = node.type.name === "video" ? "video" : "image";
  const editable = editor.isEditable;
  const containerRef = useRef<HTMLDivElement>(null);
  const [showDetails, setShowDetails] = useState(false);

  const width = attrs.width ?? 100;
  const align: Align = attrs.align ?? "center";
  const aspect = attrs.aspect || null;

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const parentWidth = parent.offsetWidth || 1;
      const startX = e.clientX;
      const startPct = width;
      const onMove = (ev: MouseEvent) => {
        const deltaPct = ((ev.clientX - startX) / parentWidth) * 100;
        const next = Math.max(15, Math.min(100, Math.round(startPct + deltaPct)));
        updateAttributes({ width: next });
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width, updateAttributes],
  );

  const marginLeft = align === "left" ? "0" : "auto";
  const marginRight = align === "right" ? "0" : "auto";

  const mediaStyle: React.CSSProperties = aspect
    ? { width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 8 }
    : { width: "100%", height: "auto", display: "block", borderRadius: 8 };

  const frameStyle: React.CSSProperties = aspect
    ? { aspectRatio: aspect, overflow: "hidden", borderRadius: 8, position: "relative", background: "#000" }
    : { position: "relative" };

  return (
    <NodeViewWrapper as="div" className="rt-media" style={{ margin: "1.25em 0" }}>
      <div
        ref={containerRef}
        className={cn("rt-media-box", editable && selected && "rt-media-selected")}
        style={{ width: `${width}%`, marginLeft, marginRight, position: "relative" }}
      >
        <div style={frameStyle}>
          {kind === "video" ? (
            <video src={attrs.src ?? undefined} controls style={mediaStyle} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attrs.src ?? undefined} alt={attrs.alt || ""} style={mediaStyle} draggable={false} />
          )}
        </div>

        {editable && selected && (
          <>
            <span
              onMouseDown={startResize}
              className="rt-resize-handle"
              title="Drag to resize"
              contentEditable={false}
            />
            <div className="rt-media-toolbar" contentEditable={false}>
              <div className="rt-tb-group">
                {WIDTH_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    title={p.title}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      updateAttributes({ width: p.value });
                    }}
                    className={cn("rt-tb-btn", width === p.value && "rt-tb-active")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="rt-tb-sep" />
              <div className="rt-tb-group">
                {(["left", "center", "right"] as Align[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    title={`Align ${a}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      updateAttributes({ align: a });
                    }}
                    className={cn("rt-tb-btn", align === a && "rt-tb-active")}
                  >
                    {a === "left" ? "⇤" : a === "center" ? "⇔" : "⇥"}
                  </button>
                ))}
              </div>
              <div className="rt-tb-sep" />
              <div className="rt-tb-group">
                {ASPECT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    title={p.title}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      updateAttributes({ aspect: p.value });
                    }}
                    className={cn("rt-tb-btn", (aspect || null) === p.value && "rt-tb-active")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="rt-tb-sep" />
              <button
                type="button"
                title="Edit caption & source"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowDetails(true);
                }}
                className="rt-tb-btn"
              >
                ✎
              </button>
            </div>
          </>
        )}

        {(attrs.caption || (attrs.showSource && attrs.sourceUrl)) && (
          <figcaption className="rt-caption">
            {attrs.caption}
            {attrs.showSource && attrs.sourceUrl && (
              <span className="rt-source">
                {attrs.caption ? " " : ""}Source:{" "}
                <a href={attrs.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {attrs.sourceLabel || attrs.sourceUrl}
                </a>
              </span>
            )}
          </figcaption>
        )}
      </div>

      {showDetails && (
        <MediaDetailsDialog
          kind={kind}
          initial={attrs}
          onSubmit={(d) => {
            updateAttributes(d);
            setShowDetails(false);
          }}
          onClose={() => setShowDetails(false)}
        />
      )}
    </NodeViewWrapper>
  );
}

const MEDIA_ATTRS = {
  src: { default: null as string | null },
  alt: { default: "" },
  caption: { default: "" },
  sourceUrl: { default: "" },
  sourceLabel: { default: "" },
  showSource: { default: true },
  width: { default: 100 },
  align: { default: "center" as Align },
  aspect: { default: null as string | null },
};

function makeMediaNode(name: string, tag: "img" | "video") {
  return Node.create({
    name,
    group: "block",
    atom: true,
    draggable: true,
    selectable: true,
    addAttributes() {
      return MEDIA_ATTRS;
    },
    parseHTML() {
      return [{ tag: `${tag}[src]` }, { tag: `figure[data-media="${name}"]` }];
    },
    renderHTML({ node }) {
      const a = node.attrs as MediaAttrs;
      const marginLeft = a.align === "left" ? "0" : "auto";
      const marginRight = a.align === "right" ? "0" : "auto";
      const mediaCss = a.aspect
        ? "width:100%;height:100%;object-fit:cover;display:block;border-radius:8px"
        : "width:100%;height:auto;display:block;border-radius:8px";
      const mediaAttrs: Record<string, string> = { src: a.src ?? "", style: mediaCss };
      if (tag === "video") mediaAttrs.controls = "true";
      else mediaAttrs.alt = a.alt ?? "";
      const frameStyle = a.aspect
        ? `aspect-ratio:${a.aspect};overflow:hidden;border-radius:8px;background:#000`
        : "";
      return [
        "figure",
        {
          "data-media": name,
          style: `margin:1.25em 0;width:${a.width ?? 100}%;margin-left:${marginLeft};margin-right:${marginRight}`,
        },
        ["div", { style: frameStyle }, [tag, mediaAttrs]],
      ];
    },
    addNodeView() {
      return ReactNodeViewRenderer(MediaNodeView);
    },
  });
}

const ImageNode = makeMediaNode("image", "img");
const FigureNode = makeMediaNode("figure", "img"); // backward-compat for older saved content
const VideoNode = makeMediaNode("video", "video");

// Audio stays a simple full-width player with optional caption/source.
const AudioNode = Node.create({
  name: "audio",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: "" },
      sourceUrl: { default: "" },
      sourceLabel: { default: "" },
      showSource: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: "audio[src]" }, { tag: 'figure[data-media="audio"]' }];
  },
  renderHTML({ node }) {
    const a = node.attrs as MediaAttrs;
    const children: unknown[] = [["audio", { src: a.src ?? "", controls: "true", style: "width:100%" }]];
    if (a.caption || (a.showSource && a.sourceUrl)) {
      children.push([
        "figcaption",
        { style: "font-size:0.85em;color:var(--text-muted);margin-top:6px;font-style:italic" },
        `${a.caption || ""}${a.showSource && a.sourceUrl ? ` — Source: ${a.sourceLabel || a.sourceUrl}` : ""}`,
      ]);
    }
    return ["figure", { "data-media": "audio", style: "margin:1.25em 0" }, ...children] as never;
  },
});

// ---------------------------------------------------------------------------
// Toolbar primitives
// ---------------------------------------------------------------------------

const tbtn =
  "flex size-8 cursor-pointer items-center justify-center rounded text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-main";
const tbtnActive = "bg-primary-glow text-primary font-semibold";

function ToolbarButton({
  action,
  isActive,
  children,
  title,
}: {
  action: () => void;
  isActive: boolean;
  children: ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        action();
      }}
      className={cn(tbtn, isActive && tbtnActive)}
      title={title}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="mx-0.5 h-5 w-px bg-line" />;
}

// ---------------------------------------------------------------------------
// Inline link dialog
// ---------------------------------------------------------------------------

function LinkDialog({
  initialUrl,
  onSubmit,
  onRemove,
  onClose,
}: {
  initialUrl: string;
  onSubmit: (url: string) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="absolute top-full left-0 z-50 mt-1 flex items-center gap-2 rounded-lg border border-line bg-bg-secondary p-2 shadow-card">
      <input
        ref={inputRef}
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const trimmed = url.trim();
            if (trimmed) onSubmit(trimmed);
            else onClose();
          }
          if (e.key === "Escape") onClose();
        }}
        placeholder="https://example.com"
        className="w-56 rounded border border-line bg-bg-primary px-2 py-1 text-xs text-text-main outline-none focus:border-primary"
      />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          const trimmed = url.trim();
          if (trimmed) onSubmit(trimmed);
          else onClose();
        }}
        className="rounded bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary-hover"
      >
        Apply
      </button>
      {onRemove && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onRemove();
          }}
          className="rounded border border-line px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10"
        >
          Remove
        </button>
      )}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        className="text-xs text-text-muted hover:text-text-main"
      >
        &times;
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branding warning modal
// ---------------------------------------------------------------------------

function BrandingWarningModal({
  mediaType,
  onAccept,
  onCancel,
}: {
  mediaType: string;
  onAccept: (watermark: boolean) => void;
  onCancel: () => void;
}) {
  const [watermark, setWatermark] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 z-50 w-[min(420px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-bg-secondary p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-warning/10 text-lg">
            &#9888;
          </span>
          <h3 className="font-heading text-base font-bold text-text-main">Media Branding Policy</h3>
        </div>
        <p className="mb-2 text-[13px] text-text-main">
          You are uploading {mediaType === "image" ? "an image" : mediaType === "video" ? "a video" : "an audio file"}.
        </p>
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <p className="text-[12px] font-semibold text-warning">
            No logos, brand marks, or watermarks allowed.
          </p>
          <p className="mt-1 text-[11.5px] text-text-muted">
            Articles may be purchased by brands who apply their own branding. The editorial team will
            review all media for compliance. Non-compliant media will be flagged and the article sent
            back for revision.
          </p>
        </div>
        {mediaType === "image" && (
          <div className="mb-4 rounded-lg border border-line bg-bg-primary p-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={watermark}
                onChange={(e) => setWatermark(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="text-[12px] text-text-main">
                Add a visible copyright watermark
                <span className="block text-[11px] text-text-muted">
                  Stamps your name in the corner. Every image also gets invisible copyright metadata automatically.
                </span>
              </span>
            </label>
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-lg border border-line bg-bg-primary px-4 py-2 text-sm font-semibold text-text-main hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onAccept(watermark)}
            className="flex-1 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            I Understand, Upload
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Media details dialog (caption + source) — used on upload and via Edit
// ---------------------------------------------------------------------------

function MediaDetailsDialog({
  kind,
  initial,
  nearDuplicateOf,
  onSubmit,
  onClose,
  onSkip,
}: {
  kind: string;
  initial?: Partial<MediaAttrs>;
  nearDuplicateOf?: string | null;
  onSubmit: (data: { caption: string; sourceUrl: string; sourceLabel: string; showSource: boolean }) => void;
  onClose: () => void;
  onSkip?: () => void;
}) {
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [sourceLabel, setSourceLabel] = useState(initial?.sourceLabel ?? "");
  const [showSource, setShowSource] = useState(initial?.showSource ?? true);

  const label = kind === "video" ? "video" : kind === "audio" ? "audio clip" : "image";

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onSkip ?? onClose} />
      <div className="fixed top-1/2 left-1/2 z-[60] w-[min(440px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-bg-secondary p-6 shadow-card">
        <h3 className="mb-1 font-heading text-base font-bold text-text-main">Media Details</h3>
        <p className="mb-4 text-[12px] text-text-muted">
          Add a caption and the source/attribution for this {label}.
        </p>
        {nearDuplicateOf && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-[11.5px] text-warning">
            This image looks similar to one already on the platform. That’s fine if it’s yours or licensed —
            just flagging it in case it isn’t.
          </div>
        )}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-text-muted">Caption (optional)</label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={`Describe the ${label}...`}
            className="w-full rounded border border-line bg-bg-primary px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
          />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-text-muted">Source URL (optional)</label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://source-website.com"
            className="w-full rounded border border-line bg-bg-primary px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
          />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-text-muted">Source Label (optional)</label>
          <input
            type="text"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            placeholder="e.g. Unsplash, Reuters, Company Name"
            className="w-full rounded border border-line bg-bg-primary px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
          />
        </div>
        <div className="mb-5 flex items-center gap-2">
          <input
            type="checkbox"
            id="showSourceCheck"
            checked={showSource}
            onChange={(e) => setShowSource(e.target.checked)}
            className="size-4 accent-primary"
          />
          <label htmlFor="showSourceCheck" className="text-xs text-text-muted">
            Show source reference on the published article
          </label>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSkip ?? onClose}
            className="flex-1 cursor-pointer rounded-lg border border-line bg-bg-primary px-4 py-2 text-sm font-semibold text-text-main hover:bg-surface-hover"
          >
            {onSkip ? "Skip" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ caption, sourceUrl: sourceUrl.trim(), sourceLabel: sourceLabel.trim(), showSource })}
            className="flex-1 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            {onSkip ? "Add" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Media upload helpers
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES: Record<string, string> = {
  image: "image/jpeg,image/png,image/gif,image/webp,image/svg+xml",
  video: "video/mp4,video/webm,video/ogg",
  audio: "audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4",
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

async function uploadFile(
  file: File,
  watermark: boolean,
): Promise<{ url: string; nearDuplicateOf: string | null }> {
  const formData = new FormData();
  formData.append("file", file);
  if (watermark) formData.append("watermark", "true");
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload failed");
  }
  const data = await res.json();
  return { url: data.url, nearDuplicateOf: data.nearDuplicateOf ?? null };
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function Toolbar({ editor, onUploadMedia }: { editor: Editor; onUploadMedia: (type: string) => void }) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const applyLink = useCallback(
    (url: string) => {
      let href = url;
      if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      setShowLinkDialog(false);
    },
    [editor],
  );

  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setShowLinkDialog(false);
  }, [editor]);

  const currentLinkUrl = editor.isActive("link")
    ? (editor.getAttributes("link").href as string) || ""
    : "";

  return (
    <div className="relative flex flex-wrap items-center gap-0.5 border-b border-line bg-bg-tertiary px-3 py-1.5">
      <ToolbarButton action={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline">
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
        <span className="line-through">S</span>
      </ToolbarButton>

      <Separator />

      <ToolbarButton action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading 2">
        H2
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Heading 3">
        H3
      </ToolbarButton>

      <Separator />

      <ToolbarButton action={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet list">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered list">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text><text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text><text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text></svg>
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Blockquote">
        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/></svg>
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Code block">
        &lt;/&gt;
      </ToolbarButton>

      <Separator />

      <div className="relative">
        <ToolbarButton action={() => setShowLinkDialog(true)} isActive={editor.isActive("link")} title="Insert link">
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        </ToolbarButton>
        {showLinkDialog && (
          <LinkDialog
            initialUrl={currentLinkUrl}
            onSubmit={applyLink}
            onRemove={editor.isActive("link") ? removeLink : undefined}
            onClose={() => setShowLinkDialog(false)}
          />
        )}
      </div>

      <ToolbarButton action={() => editor.chain().focus().setHorizontalRule().run()} isActive={false} title="Horizontal rule">
        —
      </ToolbarButton>

      <Separator />

      <ToolbarButton action={() => editor.chain().focus().setTextAlign("left").run()} isActive={editor.isActive({ textAlign: "left" })} title="Align left">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().setTextAlign("center").run()} isActive={editor.isActive({ textAlign: "center" })} title="Align center">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().setTextAlign("right").run()} isActive={editor.isActive({ textAlign: "right" })} title="Align right">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
      </ToolbarButton>

      <Separator />

      <ToolbarButton action={() => editor.chain().focus().toggleSuperscript().run()} isActive={editor.isActive("superscript")} title="Superscript">
        <span className="text-[11px]">X<sup className="text-[8px]">2</sup></span>
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().toggleSubscript().run()} isActive={editor.isActive("subscript")} title="Subscript">
        <span className="text-[11px]">X<sub className="text-[8px]">2</sub></span>
      </ToolbarButton>

      <Separator />

      <ToolbarButton action={() => onUploadMedia("image")} isActive={false} title="Upload image">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </ToolbarButton>
      <ToolbarButton action={() => onUploadMedia("video")} isActive={false} title="Upload video">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
      </ToolbarButton>
      <ToolbarButton action={() => onUploadMedia("audio")} isActive={false} title="Upload audio">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </ToolbarButton>

      <Separator />

      <ToolbarButton action={() => editor.chain().focus().undo().run()} isActive={false} title="Undo">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
      </ToolbarButton>
      <ToolbarButton action={() => editor.chain().focus().redo().run()} isActive={false} title="Redo">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.13-9.36L23 10"/></svg>
      </ToolbarButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor component
// ---------------------------------------------------------------------------

export interface RichEditorProps {
  content?: string;
  onUpdate?: (json: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

type PendingUpload = {
  url: string;
  name: string;
  kind: "image" | "video" | "audio";
  nearDuplicateOf: string | null;
};

export function RichEditor({
  content,
  onUpdate,
  placeholder = "Start writing your article...",
  className,
  editable = true,
}: RichEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingMediaType, setPendingMediaType] = useState<string | null>(null);
  const [showBrandingWarning, setShowBrandingWarning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Superscript,
      Subscript,
      ImageNode,
      FigureNode,
      VideoNode,
      AudioNode,
    ],
    content: content ? JSON.parse(content) : undefined,
    editable,
    onUpdate: ({ editor: ed }) => {
      if (!onUpdate) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate(JSON.stringify(ed.getJSON()));
      }, 300);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-8 py-6 min-h-[60vh] outline-none focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleUploadMedia = useCallback((mediaType: string) => {
    setPendingMediaType(mediaType);
    setShowBrandingWarning(true);
  }, []);

  const wantWatermarkRef = useRef(false);

  const handleBrandingAccept = useCallback(
    (watermark: boolean) => {
      wantWatermarkRef.current = watermark;
      setShowBrandingWarning(false);
      if (fileInputRef.current && pendingMediaType) {
        fileInputRef.current.accept = ACCEPTED_TYPES[pendingMediaType] || "";
        fileInputRef.current.click();
      }
    },
    [pendingMediaType],
  );

  const handleBrandingCancel = useCallback(() => {
    setShowBrandingWarning(false);
    setPendingMediaType(null);
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const kind = pendingMediaType as "image" | "video" | "audio" | null;
      if (!file || !editor || !kind) return;

      if (file.size > MAX_FILE_SIZE) {
        alert("File too large. Maximum size is 25 MB.");
        e.target.value = "";
        return;
      }

      setUploading(true);
      try {
        const { url, nearDuplicateOf } = await uploadFile(file, wantWatermarkRef.current);
        setPendingUpload({ url, name: file.name, kind, nearDuplicateOf });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Upload failed");
        setPendingMediaType(null);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [editor, pendingMediaType],
  );

  const insertPending = useCallback(
    (details: { caption: string; sourceUrl: string; sourceLabel: string; showSource: boolean }) => {
      if (!editor || !pendingUpload) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: pendingUpload.kind,
          attrs: {
            src: pendingUpload.url,
            alt: pendingUpload.name,
            caption: details.caption,
            sourceUrl: details.sourceUrl,
            sourceLabel: details.sourceLabel,
            showSource: details.showSource,
          },
        })
        .run();
      setPendingUpload(null);
      setPendingMediaType(null);
    },
    [editor, pendingUpload],
  );

  if (!editor) return null;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-bg-secondary", className)}>
      {editable && (
        <>
          <Toolbar editor={editor} onUploadMedia={handleUploadMedia} />
          {uploading && (
            <div className="border-b border-line bg-primary-glow px-4 py-1.5 text-xs font-semibold text-primary">
              Uploading media...
            </div>
          )}
        </>
      )}
      <EditorContent editor={editor} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
      {showBrandingWarning && pendingMediaType && (
        <BrandingWarningModal
          mediaType={pendingMediaType}
          onAccept={handleBrandingAccept}
          onCancel={handleBrandingCancel}
        />
      )}
      {pendingUpload && (
        <MediaDetailsDialog
          kind={pendingUpload.kind}
          nearDuplicateOf={pendingUpload.nearDuplicateOf}
          onSubmit={insertPending}
          onClose={() => {
            setPendingUpload(null);
            setPendingMediaType(null);
          }}
          onSkip={() =>
            insertPending({ caption: "", sourceUrl: "", sourceLabel: "", showSource: true })
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-only renderer for editorial / article views
// ---------------------------------------------------------------------------

export function RichContentRenderer({ content, className }: { content: string; className?: string }) {
  return <RichEditor content={content} editable={false} className={cn("border-0", className)} />;
}

// ---------------------------------------------------------------------------
// Article preview modal
// ---------------------------------------------------------------------------

export function ArticlePreviewModal({
  title,
  content,
  author,
  category,
  contentType,
  tags,
  authorVerified = false,
  authorRank = "Contributor",
  license = "all_rights_reserved",
  articleId,
  onClose,
}: {
  title: string;
  content: string;
  author: string;
  category?: string;
  contentType?: string;
  tags?: string[];
  authorVerified?: boolean;
  authorRank?: string;
  license?: string;
  /** When known, enables the Magazine Page tab (fetches placement live). */
  articleId?: string;
  onClose: () => void;
}) {
  const [view, setView] = useState<"web" | "magazine">("web");

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-primary shadow-card md:inset-y-6 md:inset-x-[8%] lg:inset-x-[12%]">
        <div className="flex items-center justify-between border-b border-line bg-bg-tertiary px-4 py-2.5">
          <div className="flex items-center gap-1">
            {(
              [
                ["web", "Web Article"],
                ["magazine", "Magazine Page"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  view === key ? "bg-primary-glow text-primary" : "text-text-muted hover:text-text-main",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full text-text-muted hover:bg-surface-hover hover:text-text-main"
          >
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 max-[640px]:p-5">
          {view === "web" ? (
            <WebArticlePreview
              title={title}
              content={content}
              author={author}
              category={category}
              contentType={contentType}
              tags={tags}
              authorVerified={authorVerified}
              authorRank={authorRank}
              license={license}
            />
          ) : (
            <MagazinePagePreview title={title} content={content} author={author} category={category} articleId={articleId} />
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Web Article tab — mirrors the real published-article layout as closely as
// possible (same byline/rights-bar/discussion structure as ArticleView), with
// interactive controls shown but disabled so it reads as "this is the shape
// of the real page", not a functional reader view.
// ---------------------------------------------------------------------------

const previewActionBtn =
  "flex cursor-not-allowed items-center gap-1.5 rounded-md border border-line bg-bg-secondary px-3 py-1.5 text-xs font-semibold text-text-muted opacity-60";

function WebArticlePreview({
  title,
  content,
  author,
  category,
  contentType,
  tags,
  authorVerified,
  authorRank,
  license,
}: {
  title: string;
  content: string;
  author: string;
  category?: string;
  contentType?: string;
  tags?: string[];
  authorVerified: boolean;
  authorRank: string;
  license: string;
}) {
  return (
    <div className="mx-auto max-w-[720px] rounded-xl border border-line bg-bg-secondary p-8 max-[640px]:p-5">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {category && (
          <span className="text-[11px] font-bold tracking-[0.5px] text-primary uppercase">{category}</span>
        )}
        {contentType && <span className="rounded bg-bg-tertiary px-2 py-0.5 text-[10.5px] font-semibold text-text-muted">{contentType}</span>}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-primary-glow px-2 py-0.5 text-[10px] font-semibold text-primary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <h1 className="mb-4 font-heading text-[28px] leading-[1.3] font-bold text-text-main max-[640px]:text-[23px]">
        {title || "Untitled Article"}
      </h1>

      <div className="mb-6 flex flex-wrap items-center gap-y-3 rounded-lg border border-line bg-bg-primary px-[18px] py-3 max-[480px]:px-4">
        <div className="mr-3 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-text-inverse">
          {author.charAt(0) || "?"}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1 text-[13.5px] font-semibold">
            {author || "Author"}
            {authorVerified && <VerifiedBadge size="xs" />}
          </span>
          <span className="text-[11px] text-text-muted">{authorRank} · — followers (shown once published)</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" disabled title="Available once published" className={cn(previewActionBtn, "cursor-not-allowed border-primary bg-primary text-text-inverse opacity-90")}>
            + Follow
          </button>
          <button type="button" disabled title="Available once published" className={previewActionBtn}>
            ☆
          </button>
          <button type="button" disabled title="Available once published" className={previewActionBtn}>
            ♡ 0
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-2.5 rounded-lg border border-line bg-bg-primary p-4 opacity-70">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="cursor-not-allowed rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-text-inverse">
            ▶ Play AI Voice Narration
          </span>
          <span className="text-[11px] text-text-muted">Available once published</span>
        </div>
        <div className="h-1 overflow-hidden rounded-sm bg-bg-tertiary" />
      </div>

      <div className="mb-8 text-[15.5px] leading-[1.8] text-text-main">
        {isRichContent(content) ? (
          <RichContentRenderer content={content} />
        ) : (
          <div className="whitespace-pre-wrap">{content || "Nothing written yet."}</div>
        )}
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-bg-primary px-4 py-3 text-[12px] text-text-muted">
        <span>
          <strong className="text-text-main">© {author || "Author"}.</strong> {licenseShort(license)}. Reproduced only
          with permission.{" "}
          <span className="cursor-not-allowed text-primary/60 underline" title="Available once published">
            Verify authenticity
          </span>
        </span>
        <button type="button" disabled title="Available once published" className="shrink-0 cursor-not-allowed rounded-md border border-line px-3 py-1.5 text-[11.5px] font-semibold text-text-muted opacity-60">
          Report copyright
        </button>
      </div>

      <div>
        <h3 className="mb-4 font-heading text-base leading-[1.25] font-bold text-text-main">Discussion (0)</h3>
        <p className="rounded-lg border border-line bg-bg-primary p-3 text-center text-[12.5px] text-text-muted">
          Comments will appear here once the article is published. (Authors can’t comment on their own article.)
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Magazine Page tab — the MYHitch weekly print/digital magazine (published
// outside Lens) picks its first 3 pages by hand; everything else fills the
// remaining pages in publish order, so writing ahead of time earns an earlier
// page. This projects where an article would land right now.
// ---------------------------------------------------------------------------

interface MagazinePlacementView {
  issue: { weekId: string; weekLabel: string };
  page: number;
  isFeatured: boolean;
  totalArticlesThisIssue: number;
  isEstimate: boolean;
}

// A page opening with a headline/byline has less room left for body copy than
// a plain continuation page, so each gets its own character budget and column
// height — otherwise every "page" holds a suspiciously identical amount of text.
const MAGAZINE_FIRST_PAGE_BUDGET = 780;
const MAGAZINE_CONTINUATION_BUDGET = 1450;
const MAGAZINE_FIRST_PAGE_COLUMN_HEIGHT = 320;
const MAGAZINE_CONTINUATION_COLUMN_HEIGHT = 480;

interface DummyIssuePiece {
  title: string;
  category: string;
  author: string;
  text: string;
}

/**
 * Standing filler for the pages around the author's own — dummy on purpose
 * (there's no real neighbouring content for a future/hypothetical issue),
 * keyed by page number so the same page always shows the same piece.
 */
const DUMMY_ISSUE_ARTICLES: DummyIssuePiece[] = [
  {
    title: "Data Snapshot: Regional Warehouse Growth",
    category: "Data",
    author: "MYHitch Research Desk",
    text: "Warehouse footprints across Central Europe and Northern Mexico have grown by double digits for six consecutive quarters, according to newly compiled leasing data. The shift tracks closely with reshoring announcements from mid-market manufacturers, who cite tariff exposure and freight volatility as the leading drivers. Analysts caution that available skilled labour, not floor space, is quickly becoming the binding constraint on how fast these new facilities can actually open for business.",
  },
  {
    title: "Q&A: Rethinking Supplier Risk",
    category: "Interview",
    author: "Priya Natarajan",
    text: "We sat down with a veteran procurement lead to talk through how supplier risk scoring has changed since 2023. Her view: single-source dependency is no longer a footnote in a risk report, it's the headline. Buyers who once optimised purely for landed cost are now paying a visibility premium just to know, in real time, how exposed a given supplier really is to a single port, a single region, or a single flashpoint.",
  },
  {
    title: "Opinion: Verification Is the New Moat",
    category: "Opinion",
    author: "MYHitch Editorial Board",
    text: "Anyone can publish. Fewer can prove who they are, what they know, and why it should be believed. As AI-generated commentary floods every feed, the platforms that win readers back won't be the ones publishing fastest — they'll be the ones who can show their work, byline by byline, credential by credential.",
  },
  {
    title: "Briefing: This Week in Trade Policy",
    category: "Briefing",
    author: "MYHitch Research Desk",
    text: "A rundown of the policy moves quietly reshaping freight lanes this quarter: a new bilateral customs pilot between two mid-sized Pacific economies, a proposed tightening of rules-of-origin thresholds, and a court ruling that could unwind a years-old tariff exemption relied on by several major retailers.",
  },
];

function dummyPieceForPage(pageNum: number): DummyIssuePiece {
  const index = ((pageNum % DUMMY_ISSUE_ARTICLES.length) + DUMMY_ISSUE_ARTICLES.length) % DUMMY_ISSUE_ARTICLES.length;
  return DUMMY_ISSUE_ARTICLES[index];
}

/** Splits text into page-sized chunks, breaking on word boundaries. */
function paginateText(text: string, firstPageBudget: number, laterPageBudget: number): string[] {
  const pages: string[] = [];
  let remaining = text.trim();
  if (!remaining) return [""];
  let index = 0;
  while (remaining.length > 0) {
    const budget = index === 0 ? firstPageBudget : laterPageBudget;
    if (remaining.length <= budget) {
      pages.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf(" ", budget);
    if (cut <= 0) cut = budget;
    pages.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
    index += 1;
  }
  return pages;
}

function rangeArray(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

const magazinePagePillBase =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full font-sans text-[11px] font-semibold transition-colors";

function DummyPieceBlock({ piece, compact }: { piece: DummyIssuePiece; compact?: boolean }) {
  return (
    <div className={compact ? "mt-4 border-t border-[#1c1a16]/15 pt-4" : ""}>
      <div className="mb-1.5 text-[10.5px] font-sans font-bold tracking-[0.16em] text-[#8a3324] uppercase">{piece.category}</div>
      <h3 className={cn("mb-2 font-bold tracking-[-0.01em] text-balance", compact ? "text-[19px] leading-[1.15]" : "text-[26px] leading-[1.12]")}>
        {piece.title}
      </h3>
      <div className="mb-3 text-[11.5px] tracking-[0.02em] italic text-[#1c1a16]/70">By {piece.author}</div>
      <div
        className={cn(
          "text-[13.5px] leading-[1.65] [hyphens:auto] [text-align:justify]",
          !compact && "[column-gap:26px] [column-rule:1px_solid_rgba(28,26,22,0.12)] max-[480px]:columns-1",
        )}
        style={compact ? undefined : { columns: 2, maxHeight: MAGAZINE_CONTINUATION_COLUMN_HEIGHT, overflow: "hidden" }}
      >
        <p className={compact ? "line-clamp-3" : "first-letter:float-left first-letter:mr-2 first-letter:mt-0.5 first-letter:font-bold first-letter:text-[44px] first-letter:leading-[34px]"}>
          {piece.text}
        </p>
      </div>
    </div>
  );
}

function MagazinePagePreview({
  title,
  content,
  author,
  category,
  articleId,
}: {
  title: string;
  content: string;
  author: string;
  category?: string;
  articleId?: string;
}) {
  const [placement, setPlacement] = useState<MagazinePlacementView | null | undefined>(undefined);
  const [viewPage, setViewPage] = useState<number | null>(null);

  useEffect(() => {
    if (!articleId) return; // JSX already special-cases !articleId ahead of `placement`
    let cancelled = false;
    getMagazinePlacement(articleId).then((p) => {
      if (!cancelled) setPlacement(p);
    });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const fullText = useMemo(() => {
    const text = isRichContent(content) ? extractPlainText(content) : content;
    return text.trim();
  }, [content]);

  const articlePages = useMemo(
    () => paginateText(fullText || "Nothing written yet.", MAGAZINE_FIRST_PAGE_BUDGET, MAGAZINE_CONTINUATION_BUDGET),
    [fullText],
  );

  if (!articleId) {
    return (
      <div className="mx-auto max-w-[600px] rounded-xl border border-line bg-bg-secondary p-8 text-center text-[13px] text-text-muted">
        Save this draft first to see its projected magazine placement.
      </div>
    );
  }
  if (placement === undefined) {
    return (
      <div className="mx-auto max-w-[600px] rounded-xl border border-line bg-bg-secondary p-8 text-center text-[13px] text-text-muted">
        Calculating placement…
      </div>
    );
  }
  if (placement === null) {
    return (
      <div className="mx-auto max-w-[600px] rounded-xl border border-line bg-bg-secondary p-8 text-center text-[13px] text-text-muted">
        Placement isn’t available for this article yet.
      </div>
    );
  }

  const startPage = placement.page;
  const endPage = startPage + articlePages.length - 1;
  const spansMultiplePages = endPage > startPage;
  const currentPage = viewPage ?? startPage;
  const withinArticle = currentPage >= startPage && currentPage <= endPage;
  const isFirstPageOfArticle = currentPage === startPage;
  const isLastPageOfArticle = currentPage === endPage;

  const minNav = Math.max(1, startPage - 2);
  const maxNav = endPage + 2;
  const railPages = rangeArray(Math.max(1, startPage - 1), endPage + 1);

  let trailingFillerPiece: DummyIssuePiece | null = null;
  if (withinArticle && isLastPageOfArticle) {
    const lastChunk = articlePages[articlePages.length - 1];
    const budget = articlePages.length === 1 ? MAGAZINE_FIRST_PAGE_BUDGET : MAGAZINE_CONTINUATION_BUDGET;
    if (lastChunk.length < budget * 0.65) trailingFillerPiece = dummyPieceForPage(endPage + 1);
  }

  return (
    <div className="mx-auto max-w-[600px]">
      {placement.isEstimate && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-[11.5px] text-warning">
          Estimated placement — projected as if this published right now. Your actual page depends on when you
          publish and how many other articles publish before you that week.
        </div>
      )}

      {/* Page navigation — lets an author flip into the (dummy) pages before
          and after theirs, so their piece reads as sitting inside a real
          multi-article issue rather than floating alone. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewPage(Math.max(minNav, currentPage - 1))}
          disabled={currentPage <= minNav}
          className="rounded-md border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-text-muted hover:border-line-hover hover:text-text-main disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Prev
        </button>
        <div className="flex items-center gap-1.5">
          {railPages.map((p) => {
            const isThisArticle = p >= startPage && p <= endPage;
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setViewPage(p)}
                title={isThisArticle ? `Page ${p} — this article` : `Page ${p} — another article (dummy)`}
                className={cn(
                  magazinePagePillBase,
                  isActive
                    ? "bg-primary text-text-inverse"
                    : isThisArticle
                      ? "bg-primary-glow text-primary hover:bg-primary/20"
                      : "bg-bg-tertiary text-text-muted hover:text-text-main",
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setViewPage(Math.min(maxNav, currentPage + 1))}
          disabled={currentPage >= maxNav}
          className="rounded-md border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-text-muted hover:border-line-hover hover:text-text-main disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>
      {spansMultiplePages && (
        <p className="mb-3 text-center text-[11px] text-text-muted">
          This piece runs {articlePages.length} pages at its current length — pages {startPage}–{endPage}.
        </p>
      )}

      {/* The physical page — a distinct print typography system (serif,
          running head, folio) on purpose: the magazine is a separate
          product from the Lens web app, and this should read as a page
          torn from it, not another app card. */}
      <div
        className="mx-auto overflow-hidden rounded-[2px] bg-[#fbfaf6] text-[#1c1a16] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_18px_38px_rgba(20,16,8,0.16)] ring-1 ring-black/5"
        style={{ fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif" }}
      >
        <div className="px-9 pt-7 pb-5 max-[480px]:px-6">
          {/* Running head */}
          <div className="mb-5 flex items-center justify-between border-b border-[#1c1a16]/70 pb-2">
            <span className="font-sans text-[10px] font-bold tracking-[0.22em] uppercase">MYHitch Magazine</span>
            <span className="font-sans text-[10px] tracking-[0.1em] text-[#1c1a16]/60 uppercase">{placement.issue.weekLabel}</span>
          </div>

          {withinArticle ? (
            isFirstPageOfArticle ? (
              <>
                {placement.isFeatured && (
                  <div className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.14em] text-[#9a6a00] uppercase">
                    <span>★</span> Editors&rsquo; Pick
                  </div>
                )}
                {category && (
                  <div className="mb-1.5 text-[10.5px] font-sans font-bold tracking-[0.16em] text-[#8a3324] uppercase">{category}</div>
                )}
                <h2 className="mb-3 text-[32px] leading-[1.08] font-bold tracking-[-0.01em] text-balance">
                  {title || "Untitled Article"}
                </h2>
                <div className="mb-5 flex items-center gap-3 border-y border-[#1c1a16]/15 py-2 text-[12px] tracking-[0.02em] italic text-[#1c1a16]/70">
                  By {author || "Author"}
                </div>
              </>
            ) : (
              <div className="mb-4 text-center text-[11.5px] tracking-[0.04em] text-[#1c1a16]/60 italic">
                {title || "Untitled Article"} &nbsp;·&nbsp; continued from page {currentPage - 1}
              </div>
            )
          ) : (
            <div className="mb-4 text-[10px] font-sans font-bold tracking-[0.16em] text-[#1c1a16]/40 uppercase">
              In this issue
            </div>
          )}

          {withinArticle ? (
            <>
              <div
                className="relative text-[13.5px] leading-[1.65] [column-gap:26px] [column-rule:1px_solid_rgba(28,26,22,0.12)] [hyphens:auto] [text-align:justify] max-[480px]:columns-1"
                style={{
                  columns: 2,
                  maxHeight: isFirstPageOfArticle ? MAGAZINE_FIRST_PAGE_COLUMN_HEIGHT : MAGAZINE_CONTINUATION_COLUMN_HEIGHT,
                  overflow: "hidden",
                }}
              >
                <p
                  className={
                    isFirstPageOfArticle
                      ? "first-letter:float-left first-letter:mr-2 first-letter:mt-0.5 first-letter:font-bold first-letter:text-[52px] first-letter:leading-[38px]"
                      : undefined
                  }
                >
                  {articlePages[currentPage - startPage]}
                </p>
              </div>
              {!isLastPageOfArticle && (
                <p className="mt-1 text-right text-[11px] italic text-[#1c1a16]/60">
                  Continued on page {currentPage + 1} →
                </p>
              )}
              {trailingFillerPiece && <DummyPieceBlock piece={trailingFillerPiece} compact />}
            </>
          ) : (
            <DummyPieceBlock piece={dummyPieceForPage(currentPage)} />
          )}
        </div>

        {/* Folio */}
        <div className="flex items-center justify-between border-t border-[#1c1a16]/70 px-9 py-2.5 font-sans text-[10px] tracking-[0.14em] text-[#1c1a16]/60 uppercase max-[480px]:px-6">
          <span>MYHitch Weekly</span>
          <span>Page {currentPage} of {placement.totalArticlesThisIssue}</span>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-text-muted">
        Pages 1–3 are hand-picked by the MYHitch editorial team each week; every other page follows publish order —
        publish earlier to land on an earlier page. Neighbouring pages here are placeholders so you can see how your
        piece sits inside a real issue.
      </p>
    </div>
  );
}

function extractPlainText(json: string): string {
  try {
    const doc = JSON.parse(json);
    const parts: string[] = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== "object") return;
      const node = n as { type?: string; text?: string; content?: unknown[] };
      if (node.type === "text" && node.text) parts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(walk);
    };
    walk(doc);
    return parts.join(" ");
  } catch {
    return "";
  }
}

function isRichContent(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && parsed.type === "doc";
  } catch {
    return false;
  }
}
