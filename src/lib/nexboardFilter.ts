import type { Prisma } from "@prisma/client";

/**
 * Hides articles MYHitch NexBoard rejected (NexBoard plan 13zj; lib/nexboardReview.ts). A rejected article is also sent back to
 * changes_requested, so every "published" list drops it anyway; this keeps it hidden if it is ever published again unchanged.
 * Spread into every query that shows articles to readers or the MYHitch app. Kept apart so list modules import nothing else.
 */
export const NOT_REJECTED = { NOT: { nexboardReview: { is: { status: "rejected" } } } } satisfies Prisma.ArticleWhereInput;
