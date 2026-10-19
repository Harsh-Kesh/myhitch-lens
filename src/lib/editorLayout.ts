import type { Editor } from "@tiptap/react";

/**
 * Helpers for inserting layout suggestions (pull quotes, section headings) into
 * the editor. Plain document logic, kept apart from the React components.
 */

/** Collapse whitespace and straighten curly quotes so AI-copied text can be matched against the article. */
export function normaliseForMatch(s: string): string {
  return s
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** The top-level block (paragraph, list, ...) whose text satisfies `test`, with its start position and size. */
function findTopLevelBlock(editor: Editor, test: (normalisedText: string) => boolean) {
  let found: { pos: number; size: number; type: string } | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (!found && test(normaliseForMatch(node.textContent))) found = { pos: offset, size: node.nodeSize, type: node.type.name };
  });
  return found as { pos: number; size: number; type: string } | null;
}

/** Is this passage already in the article as a block quote? */
export function isPulledQuote(editor: Editor, quote: string): boolean {
  const norm = normaliseForMatch(quote);
  if (!norm) return false;
  let found = false;
  editor.state.doc.forEach((node) => {
    if (node.type.name === "blockquote" && normaliseForMatch(node.textContent).includes(norm)) found = true;
  });
  return found;
}

/**
 * Add `quote` as a block quote directly after the paragraph it comes from.
 * Returns false if the passage can't be found, or is already a quote
 * (check `isPulledQuote` first to tell the two apart).
 */
export function insertPullQuote(editor: Editor, quote: string): boolean {
  const norm = normaliseForMatch(quote);
  if (!norm || isPulledQuote(editor, quote)) return false;
  const block = findTopLevelBlock(editor, (t) => t.includes(norm));
  if (!block) return false;
  return editor
    .chain()
    .focus()
    .insertContentAt(block.pos + block.size, {
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text: quote }] }],
    })
    .run();
}

/**
 * Add an H2 directly above the paragraph that opens with `before`.
 * Returns false if that paragraph can't be found.
 */
export function insertHeading(editor: Editor, before: string, heading: string): boolean {
  const norm = normaliseForMatch(before);
  if (!norm) return false;
  const block = findTopLevelBlock(editor, (t) => t.startsWith(norm));
  if (!block) return false;
  return editor
    .chain()
    .focus()
    .insertContentAt(block.pos, {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: heading }],
    })
    .run();
}
