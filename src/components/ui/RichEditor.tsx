"use client";

import { useEditor, EditorContent, Node, mergeAttributes, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import ImageExtension from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Custom extensions: Video & Audio
// ---------------------------------------------------------------------------

const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "video" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "true",
        style: "max-width:100%;border-radius:8px;margin:8px 0",
      }),
    ];
  },
});

const AudioNode = Node.create({
  name: "audio",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "audio" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "audio",
      mergeAttributes(HTMLAttributes, {
        controls: "true",
        style: "width:100%;margin:8px 0",
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

const tbtn =
  "flex size-8 cursor-pointer items-center justify-center rounded text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-main";
const tbtnActive = "bg-primary-glow text-primary font-semibold";

function ToolbarButton({
  editor,
  action,
  isActive,
  children,
  title,
}: {
  editor: Editor;
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
// Branding warning modal
// ---------------------------------------------------------------------------

function BrandingWarningModal({
  mediaType,
  onAccept,
  onCancel,
}: {
  mediaType: string;
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 z-50 w-[min(420px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-bg-secondary p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-warning/10 text-lg">
            &#9888;
          </span>
          <h3 className="font-heading text-base font-bold text-text-main">
            Media Branding Policy
          </h3>
        </div>
        <p className="mb-2 text-[13px] text-text-main">
          You are uploading {mediaType === "image" ? "an image" : mediaType === "video" ? "a video" : "an audio file"}.
        </p>
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <p className="text-[12px] font-semibold text-warning">
            No logos, brand marks, or watermarks allowed.
          </p>
          <p className="mt-1 text-[11.5px] text-text-muted">
            Articles may be purchased by brands who apply their own branding.
            The editorial team will review all media for compliance. Non-compliant
            media will be flagged and the article sent back for revision.
          </p>
        </div>
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
            onClick={onAccept}
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
// Media upload helpers
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES: Record<string, string> = {
  image: "image/jpeg,image/png,image/gif,image/webp,image/svg+xml",
  video: "video/mp4,video/webm,video/ogg",
  audio: "audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4",
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload failed");
  }
  const data = await res.json();
  return data.url;
}

// ---------------------------------------------------------------------------
// Toolbar with media
// ---------------------------------------------------------------------------

function Toolbar({ editor, onUploadMedia }: { editor: Editor; onUploadMedia: (type: string) => void }) {
  const addLink = useCallback(() => {
    const url = window.prompt("URL");
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-bg-tertiary px-3 py-1.5">
      {/* Text style */}
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline"
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <span className="line-through">S</span>
      </ToolbarButton>

      <Separator />

      {/* Headings */}
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolbarButton>

      <Separator />

      {/* Lists & blocks */}
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text><text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text><text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text></svg>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Blockquote"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/></svg>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title="Code block"
      >
        &lt;/&gt;
      </ToolbarButton>

      <Separator />

      {/* Link */}
      <ToolbarButton
        editor={editor}
        action={addLink}
        isActive={editor.isActive("link")}
        title="Insert link"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
      </ToolbarButton>

      {/* Horizontal rule */}
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().setHorizontalRule().run()}
        isActive={false}
        title="Horizontal rule"
      >
        —
      </ToolbarButton>

      <Separator />

      {/* Text alignment */}
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        title="Align left"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        title="Align center"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        title="Align right"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
      </ToolbarButton>

      <Separator />

      {/* Superscript / subscript */}
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleSuperscript().run()}
        isActive={editor.isActive("superscript")}
        title="Superscript"
      >
        <span className="text-[11px]">X<sup className="text-[8px]">2</sup></span>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleSubscript().run()}
        isActive={editor.isActive("subscript")}
        title="Subscript"
      >
        <span className="text-[11px]">X<sub className="text-[8px]">2</sub></span>
      </ToolbarButton>

      <Separator />

      {/* Media uploads */}
      <ToolbarButton
        editor={editor}
        action={() => onUploadMedia("image")}
        isActive={false}
        title="Upload image"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => onUploadMedia("video")}
        isActive={false}
        title="Upload video"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => onUploadMedia("audio")}
        isActive={false}
        title="Upload audio"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </ToolbarButton>

      <Separator />

      {/* Undo / Redo */}
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().undo().run()}
        isActive={false}
        title="Undo"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().redo().run()}
        isActive={false}
        title="Redo"
      >
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
      Underline,
      ImageExtension.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Superscript,
      Subscript,
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
        class:
          "prose prose-sm max-w-none px-8 py-6 min-h-[60vh] outline-none focus:outline-none",
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

  const handleBrandingAccept = useCallback(() => {
    setShowBrandingWarning(false);
    if (fileInputRef.current && pendingMediaType) {
      fileInputRef.current.accept = ACCEPTED_TYPES[pendingMediaType] || "";
      fileInputRef.current.click();
    }
  }, [pendingMediaType]);

  const handleBrandingCancel = useCallback(() => {
    setShowBrandingWarning(false);
    setPendingMediaType(null);
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor || !pendingMediaType) return;

      if (file.size > MAX_FILE_SIZE) {
        alert("File too large. Maximum size is 25 MB.");
        e.target.value = "";
        return;
      }

      setUploading(true);
      try {
        const url = await uploadFile(file);
        if (pendingMediaType === "image") {
          editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        } else if (pendingMediaType === "video") {
          editor
            .chain()
            .focus()
            .insertContent({ type: "video", attrs: { src: url, alt: file.name } })
            .run();
        } else if (pendingMediaType === "audio") {
          editor
            .chain()
            .focus()
            .insertContent({ type: "audio", attrs: { src: url, alt: file.name } })
            .run();
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        setPendingMediaType(null);
        e.target.value = "";
      }
    },
    [editor, pendingMediaType],
  );

  if (!editor) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-line bg-bg-secondary",
        className,
      )}
    >
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
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
      />
      {showBrandingWarning && pendingMediaType && (
        <BrandingWarningModal
          mediaType={pendingMediaType}
          onAccept={handleBrandingAccept}
          onCancel={handleBrandingCancel}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-only renderer for editorial/article views
// ---------------------------------------------------------------------------

export function RichContentRenderer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <RichEditor
      content={content}
      editable={false}
      className={cn("border-0", className)}
    />
  );
}
