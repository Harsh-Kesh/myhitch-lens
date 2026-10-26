/**
 * Lens articles (the editor's TipTap JSON) as the MYHitch app shows and edits
 * them, through the hub: simple blocks with their formatting, links, pictures
 * and clips. No server-only imports, so it can be checked on its own.
 */

type Mark = { type?: string; attrs?: Record<string, unknown> };
type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: Node[]; marks?: Mark[] };

function parseDoc(content: string): Node | null {
  try {
    const doc = JSON.parse(content);
    return doc && typeof doc === "object" ? (doc as Node) : null;
  } catch {
    return null;
  }
}

function textOf(node: Node): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(textOf).join("");
}

/** A run of text with its formatting; [href] is a link (http, https or mailto only). */
export type Span = {
  text: string;
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  code?: true;
  href?: string;
};

export type Block =
  | { type: "heading"; level: number; text: string; spans: Span[] }
  | { type: "paragraph"; text: string; spans: Span[] }
  | { type: "quote"; text: string; spans: Span[] }
  | { type: "list"; ordered: boolean; items: string[]; itemSpans: Span[][] }
  | { type: "image"; src: string; alt: string; caption: string }
  | { type: "video"; src: string; caption: string }
  | { type: "audio"; src: string; caption: string }
  | { type: "code"; text: string }
  | { type: "divider" };

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;
const SIMPLE_MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);

/** What a reader in the app sees, and whether it had to leave anything out. */
type Reading = { blocks: Block[]; flattened: boolean };

/** The caption as the website shows it under a picture or clip. */
function captionOf(attrs: Record<string, unknown> | undefined): string {
  const caption = String(attrs?.caption ?? "").trim();
  const source = attrs?.showSource !== false ? String(attrs?.sourceLabel || attrs?.sourceUrl || "").trim() : "";
  return [caption, source ? `Source: ${source}` : ""].filter(Boolean).join(" - ");
}

function read(content: string): Reading {
  const doc = parseDoc(content);
  if (!doc) return { blocks: content.trim() ? [{ type: "paragraph", text: content.trim(), spans: [{ text: content.trim() }] }] : [], flattened: false };
  let flattened = false;

  const spansOf = (node: Node): Span[] => {
    const spans: Span[] = [];
    const walk = (n: Node) => {
      if (n.type === "hardBreak") {
        spans.push({ text: "\n" });
      } else if (n.type === "text") {
        if (!n.text) return;
        const span: Span = { text: n.text };
        for (const m of n.marks ?? []) {
          if (!SIMPLE_MARKS.has(m.type ?? "")) flattened = true; // e.g. superscript
          if (m.type === "bold") span.bold = true;
          else if (m.type === "italic") span.italic = true;
          else if (m.type === "underline") span.underline = true;
          else if (m.type === "strike") span.strike = true;
          else if (m.type === "code") span.code = true;
          else if (m.type === "link") {
            const href = String(m.attrs?.href ?? "");
            if (SAFE_LINK.test(href)) span.href = href;
          }
        }
        spans.push(span);
      } else {
        if (n.type && !["paragraph", "heading"].includes(n.type)) flattened = true;
        (n.content ?? []).forEach(walk);
      }
    };
    (node.content ?? []).forEach(walk);
    return spans;
  };

  // Paragraphs inside a quote or a list item, one line each.
  const joined = (nodes: Node[]): Span[] =>
    nodes.flatMap((n, i) => {
      if (n.type !== "paragraph") flattened = true; // e.g. a list inside a list
      const spans = n.type === "paragraph" ? spansOf(n) : [{ text: textOf(n) }];
      return i === 0 ? spans : [{ text: "\n" }, ...spans];
    });

  const flat = (spans: Span[]) => spans.map((s) => s.text).join("");

  const blocks: Block[] = [];
  for (const node of doc.content ?? []) {
    switch (node.type) {
      case "heading": {
        const spans = spansOf(node);
        blocks.push({ type: "heading", level: Number(node.attrs?.level ?? 2), text: flat(spans), spans });
        break;
      }
      case "paragraph": {
        const spans = spansOf(node);
        if (flat(spans).trim()) blocks.push({ type: "paragraph", text: flat(spans), spans });
        break;
      }
      case "blockquote": {
        const spans = joined(node.content ?? []);
        blocks.push({ type: "quote", text: flat(spans), spans });
        break;
      }
      case "bulletList":
      case "orderedList": {
        const itemSpans = (node.content ?? []).map((li) => joined(li.content ?? []));
        blocks.push({ type: "list", ordered: node.type === "orderedList", items: itemSpans.map(flat), itemSpans });
        break;
      }
      case "image":
      case "figure": {
        const src = String(node.attrs?.src ?? "");
        if (/^https:\/\//.test(src)) {
          blocks.push({ type: "image", src, alt: String(node.attrs?.alt ?? ""), caption: captionOf(node.attrs) });
        } else flattened = true;
        break;
      }
      case "video":
      case "audio": {
        const src = String(node.attrs?.src ?? "");
        if (/^https:\/\//.test(src)) blocks.push({ type: node.type, src, caption: captionOf(node.attrs) });
        // The app can't play clips in the article yet: it sends readers to Lens for them.
        flattened = true;
        break;
      }
      case "codeBlock":
        blocks.push({ type: "code", text: textOf(node) });
        break;
      case "horizontalRule":
        blocks.push({ type: "divider" });
        break;
      default: {
        flattened = true;
        const text = textOf(node);
        if (text.trim()) blocks.push({ type: "paragraph", text, spans: [{ text }] });
      }
    }
  }
  return {
    blocks: blocks.filter((b) => !("text" in b) || b.text.trim() || b.type === "code"),
    flattened,
  };
}

/** The article as simple blocks the app can show. */
export function blocksOf(content: string): Block[] {
  return read(content).blocks;
}

/**
 * The article for the app's reader: its blocks, and whether anything was left
 * out or simplified (the app then offers to open it on Lens).
 */
export function readingOf(content: string): Reading {
  return read(content);
}

/** The first picture in the article, for its card. */
export function coverOf(content: string): string | null {
  return blocksOf(content).find((b): b is Extract<Block, { type: "image" }> => b.type === "image")?.src ?? null;
}

/** Plain text - and whether the app can edit it without losing formatting. */
export function plainOf(content: string): { text: string; editable: boolean } {
  const doc = parseDoc(content);
  if (!doc) return { text: content, editable: true };
  const nodes = doc.content ?? [];
  const editable = nodes.every(
    (n) =>
      n.type === "paragraph" &&
      (n.content ?? []).every((c) => (c.type === "text" && !c.marks?.length) || c.type === "hardBreak"),
  );
  return { text: blocksOf(content).map((b) => ("text" in b ? b.text : "")).filter(Boolean).join("\n\n"), editable };
}

export function docOf(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  });
}
