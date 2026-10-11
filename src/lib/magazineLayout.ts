/**
 * The shape of the one monthly MYHitch Lens magazine: 128 pages, split into
 * sections. Plain data (no server imports) so plans, placement and the screens
 * all read the same page numbers.
 *
 * Which plan may land where is a plan entitlement (`magazineRange` in plans.ts);
 * the sections below name the blocks of pages those ranges are drawn from.
 */

export const MAGAZINE_PAGES = 128;

export interface PageRange {
  from: number;
  to: number;
}

export interface MagazineSection extends PageRange {
  label: string;
}

export const MAGAZINE_SECTIONS = {
  /** Cover, contents, editor's message: MYHitch only, never author articles. */
  editorial: { label: "MYHitch Editorial", from: 1, to: 8 },
  premium: { label: "Premium Editorial", from: 9, to: 56 },
  middle: { label: "Middle Editorial", from: 57, to: 120 },
  contributors: { label: "Free Contributors", from: 121, to: 124 },
  /** Approved sponsors, acknowledgements and the back cover: placed by MYHitch. */
  closing: { label: "Sponsors & Closing", from: 125, to: 128 },
} as const satisfies Record<string, MagazineSection>;

export function sectionOfPage(page: number): MagazineSection | null {
  return Object.values(MAGAZINE_SECTIONS).find((s) => page >= s.from && page <= s.to) ?? null;
}

/** "121–124", or just "121" for a single page. */
export function formatPageRange(from: number, to: number): string {
  return from === to ? `${from}` : `${from}–${to}`;
}
