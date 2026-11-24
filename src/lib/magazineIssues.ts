import "server-only";

/**
 * The designed MYHitch Lens magazine issues. They are laid out by MYHitch's
 * graphic designers in NexBoard's Magazine studio, signed off there and
 * released on their date. NexBoard publishes each released issue as page
 * images plus a manifest (links, videos, page text, which article is on
 * which page) in its public storage folder, MAGAZINE_FEED_URL:
 *
 *   {MAGAZINE_FEED_URL}/issues/index.json   every released issue, newest first
 *   {manifest}                              one issue (address listed in the index)
 *
 * Read-only and cached for a minute. When MAGAZINE_FEED_URL is unset, Lens
 * simply has no designed issues yet.
 */

export type IssueSummary = {
  number: number;
  title: string;
  releaseOn: string;
  releasedAt: string | null;
  cover: string | null;
  pages: number;
  manifest: string | null;
};

export type IssueManifest = {
  issue: number;
  title: string;
  releaseOn: string;
  width: number;
  height: number;
  cover: string;
  pages: {
    n: number;
    image: string;
    text: string;
    links: { x: number; y: number; w: number; h: number; href?: string; page?: number }[];
    videos: { x: number; y: number; w: number; h: number; src: string }[];
  }[];
  stories: { articleId: string; title: string; author: string; firstPage: number; lastPage: number; sponsor: string | null }[];
  contents: { title: string; page: number; author: string; sponsor: string | null }[];
  version: string;
  createdAt: string;
};

const base = () => process.env.MAGAZINE_FEED_URL?.replace(/\/$/, "") ?? null;

/** Only NexBoard's own storage folder is trusted for manifests and page images. */
function fromFeed(url: string | null | undefined): string | null {
  const b = base();
  return b && url && url.startsWith(`${b}/`) ? url : null;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { next: { revalidate: 60 } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function listIssues(): Promise<IssueSummary[]> {
  const b = base();
  if (!b) return [];
  const data = await getJson<{ issues?: IssueSummary[] }>(`${b}/issues/index.json`);
  return (data?.issues ?? []).filter((i) => Number.isInteger(i.number) && fromFeed(i.manifest));
}

export async function getIssue(number: number): Promise<IssueManifest | null> {
  const summary = (await listIssues()).find((i) => i.number === number);
  const url = fromFeed(summary?.manifest);
  if (!url) return null;
  const m = await getJson<IssueManifest>(url);
  if (!m || !Array.isArray(m.pages)) return null;
  // page images must come from the same folder; links only to the web or to a page of the issue
  return {
    ...m,
    pages: m.pages
      .filter((p) => fromFeed(p.image))
      .map((p) => ({
        ...p,
        links: (p.links ?? []).filter((l) => (l.href ? /^https?:\/\//.test(l.href) : Number.isInteger(l.page))),
        videos: (p.videos ?? []).filter((v) => /^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//.test(v.src)),
      })),
  };
}

/** The released page an article is printed on, if it is in a released designed issue (newest issue first). */
export async function releasedPlacement(articleId: string): Promise<{ issue: IssueSummary; firstPage: number; lastPage: number } | null> {
  for (const issue of await listIssues()) {
    const m = await getIssue(issue.number);
    const s = m?.stories.find((x) => x.articleId === articleId);
    if (s) return { issue, firstPage: s.firstPage, lastPage: s.lastPage };
  }
  return null;
}
