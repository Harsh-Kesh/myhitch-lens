/**
 * How an article's text is split across magazine pages. Shared by the page view
 * (what the reader sees) and by submission (so a plan's "pages per article" cap
 * is measured the same way it is rendered). Plain functions, no server imports.
 */

// Sized to what a real magazine page actually holds in two columns of running
// text (~550-650 words), not to what looked tidy in a small mockup box.
export const FIRST_PAGE_BUDGET = 2600;
export const CONTINUATION_BUDGET = 3800;

/** Splits text into page-sized chunks, breaking on word boundaries. */
export function paginateText(text: string, firstPageBudget = FIRST_PAGE_BUDGET, laterPageBudget = CONTINUATION_BUDGET): string[] {
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

/** How many magazine pages this text runs to. */
export function pagesNeeded(text: string): number {
  return paginateText(text).length;
}
