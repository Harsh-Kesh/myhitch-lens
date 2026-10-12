/**
 * Does an article's content (the editor's JSON document, or older HTML text) embed
 * video or audio? Plain images do not count. Used to enforce plans that do not
 * include video/media embedding, wherever the content could have come from (the
 * toolbar, a paste, an old draft).
 */
export function articleHasVideoOrAudio(content: string): boolean {
  try {
    return containsMediaNode(JSON.parse(content));
  } catch {
    return /<\s*(video|audio)\b/i.test(content);
  }
}

function containsMediaNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: unknown; content?: unknown };
  if (n.type === "video" || n.type === "audio") return true;
  return Array.isArray(n.content) && n.content.some(containsMediaNode);
}
