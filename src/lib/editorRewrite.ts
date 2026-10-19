import type { Editor } from "@tiptap/react";

/**
 * Selection handling for the editor's AI rewrite menu: work out what the author
 * selected, and swap the AI's rewrite in for it. Kept apart from the React
 * component so the document logic stays small and testable.
 */

export type RewriteSelection = {
  from: number;
  to: number;
  text: string;
  /** Top-level blocks fully covered by a multi-paragraph selection (empty for a selection inside one block). */
  blocks: { type: string; attrs: Record<string, unknown> }[];
};

/** What the author selected, if it's something we can safely rewrite. */
export function readRewriteSelection(editor: Editor): RewriteSelection | { error: string } {
  const { from, to, empty } = editor.state.selection;
  if (empty) return { error: "Select the text you want to rewrite first, then click AI." };

  const blocks: { pos: number; size: number; type: string; attrs: Record<string, unknown>; topLevel: boolean }[] = [];
  editor.state.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (node.isTextblock) {
      blocks.push({ pos, size: node.nodeSize, type: node.type.name, attrs: node.attrs, topLevel: parent?.type.name === "doc" });
      return false;
    }
    return true;
  });
  if (blocks.length === 0) return { error: "Select some text to rewrite." };
  if (blocks.some((b) => b.type === "codeBlock")) return { error: "Code blocks can't be rewritten." };

  if (blocks.length === 1) {
    const text = editor.state.doc.textBetween(from, to, "\n", "\n");
    return { from, to, text, blocks: [] };
  }
  // Several paragraphs: rewrite whole paragraphs, and only plain top-level ones (not list items or quotes).
  if (!blocks.every((b) => b.topLevel)) {
    return { error: "Select text inside one paragraph or list item, or whole paragraphs, to rewrite." };
  }
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  const start = first.pos + 1;
  const end = last.pos + last.size - 1;
  return {
    from: start,
    to: end,
    text: editor.state.doc.textBetween(start, end, "\n\n", "\n"),
    blocks: blocks.map((b) => ({ type: b.type, attrs: b.attrs })),
  };
}

export function applyRewrite(editor: Editor, sel: RewriteSelection, rewritten: string): string | null {
  // The author may have kept typing while the AI worked; never overwrite text that has changed.
  const current = editor.state.doc.textBetween(sel.from, sel.to, sel.blocks.length ? "\n\n" : "\n", "\n");
  if (current !== sel.text) return "Your text changed while the AI was working. Select it again and retry.";

  if (sel.blocks.length === 0) {
    // Inside one block: swap the text only, keeping the block (and the formatting at the start of the selection).
    editor.view.dispatch(editor.state.tr.insertText(rewritten.replace(/\s*\n+\s*/g, " "), sel.from, sel.to));
    editor.commands.focus();
    return null;
  }

  const parts = rewritten.split(/\n{2,}/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const sameShape = parts.length === sel.blocks.length;
  const nodes = parts.map((text, i) =>
    sameShape
      ? { type: sel.blocks[i].type, attrs: sel.blocks[i].attrs, content: [{ type: "text", text }] }
      : { type: "paragraph", content: [{ type: "text", text }] },
  );
  editor.chain().focus().insertContentAt({ from: sel.from - 1, to: sel.to + 1 }, nodes).run();
  return null;
}
