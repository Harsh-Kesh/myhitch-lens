/**
 * Last step before imported HTML goes into the editor (runs in the browser). Two things need the page's own
 * conventions: the document's title belongs in the title field, and the editor's headings run H2 to H4, so the
 * document's heading levels are moved down together, keeping every heading's rank relative to the others.
 */

export type ImportStats = {
  words: number;
  headings: number;
  paragraphs: number;
  lists: number;
  tables: number;
  images: number;
};

export type PreparedImport = {
  html: string;
  /** The document's title when it was taken out of the body for the title field. */
  title: string | null;
  stats: ImportStats;
};

const MAX_TITLE_CHARS = 200;
const HEADING = /^H[1-6]$/;

function retag(el: Element, tag: string): Element {
  const next = el.ownerDocument.createElement(tag);
  for (const attr of Array.from(el.attributes)) next.setAttribute(attr.name, attr.value);
  while (el.firstChild) next.appendChild(el.firstChild);
  el.replaceWith(next);
  return next;
}

export function prepareImport(html: string, opts: { takeTitle: boolean }): PreparedImport {
  const body = new DOMParser().parseFromString(html, "text/html").body;

  let title: string | null = null;
  const first = body.firstElementChild;
  if (opts.takeTitle && first?.tagName === "H1") {
    const isDocTitle = first.classList.contains("doc-title");
    if (isDocTitle || body.querySelectorAll("h1").length === 1) {
      const text = (first.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) {
        title = text.slice(0, MAX_TITLE_CHARS);
        first.remove();
      }
    }
  }

  // Any H1 left is a section heading, so everything moves down a level (H1 -> H2 ... H3 -> H4).
  const shift = body.querySelector("h1") ? 1 : 0;
  for (const el of Array.from(body.querySelectorAll("h1,h2,h3,h4,h5,h6"))) {
    if (!HEADING.test(el.tagName)) continue;
    const level = Math.min(4, Number(el.tagName[1]) + shift);
    if (level !== Number(el.tagName[1])) retag(el, `h${level}`);
  }

  const text = (body.textContent ?? "").trim();
  const stats: ImportStats = {
    words: text ? text.split(/\s+/).length : 0,
    headings: body.querySelectorAll("h1,h2,h3,h4,h5,h6").length,
    paragraphs: body.querySelectorAll("p").length,
    lists: body.querySelectorAll("ul,ol").length,
    tables: body.querySelectorAll("table").length,
    images: body.querySelectorAll("img").length,
  };
  return { html: body.innerHTML, title, stats };
}
