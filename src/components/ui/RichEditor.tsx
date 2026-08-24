"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import ImageExtension from "@tiptap/extension-image";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

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

function Toolbar({ editor }: { editor: Editor }) {
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
      Underline,
      ImageExtension.configure({ inline: false }),
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

  if (!editor) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-line bg-bg-secondary",
        className,
      )}
    >
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
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
