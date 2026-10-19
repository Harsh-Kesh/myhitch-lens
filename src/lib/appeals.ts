import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Authors' appeals on their own articles, shared by the website
 * (src/app/(portal)/article/actions.ts) and the MYHitch app (through the hub).
 * Appeals are DisputeTickets whose subject is "<articleId> — <title>".
 * `status` is the HTTP status the hub answers with.
 */

export const EDITORIAL_APPEAL_REASONS = ["plagiarism", "category", "editorial", "other"] as const;
export type EditorialAppealReason = (typeof EDITORIAL_APPEAL_REASONS)[number];

export type AppealResult = { error: string; status: number } | { ok: true; id: string };

type Author = { id: string; name: string | null | undefined };

function articleIdFromSubject(subject: string): string {
  return subject.split(" — ")[0]?.trim() ?? "";
}

/** An "appeal" notification for every editor and admin. */
async function staffNotices(text: string) {
  const staff = await prisma.user.findMany({ where: { role: { in: ["editor", "admin"] } }, select: { id: true } });
  return staff.map((u) => ({ userId: u.id, type: "appeal", text }));
}

/** Author files a counter-notice against a copyright takedown of their article. */
export async function appealTakedownFor(author: Author, articleId: string, appealText: string): Promise<AppealResult> {
  const text = appealText.trim();
  if (!text) return { error: "Explain why the removal should be reversed.", status: 400 };

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, status: true, title: true },
  });
  if (!article) return { error: "Article not found.", status: 404 };
  if (article.authorId !== author.id) return { error: "Not your article.", status: 403 };
  if (article.status !== "rejected") return { error: "This article hasn't been removed.", status: 400 };

  const ticket = await prisma.disputeTicket.findFirst({
    where: { subject: { startsWith: `${articleId} — ` }, reason: "copyright", status: "resolved" },
    orderBy: { createdAt: "desc" },
  });
  if (!ticket) return { error: "No copyright takedown found for this article.", status: 400 };
  if (ticket.appealStatus !== "none") return { error: "An appeal has already been filed for this removal.", status: 409 };

  await prisma.$transaction([
    prisma.disputeTicket.update({
      where: { id: ticket.id },
      data: { appealStatus: "pending", appealText: text, appealedAt: new Date() },
    }),
    prisma.notification.createMany({ data: await staffNotices(`${author.name ?? "An author"} appealed the removal of "${article.title}".`) }),
  ]);

  return { ok: true, id: ticket.id };
}

/**
 * Author disputes a non-copyright editorial call on their own article — an
 * inaccurate plagiarism flag, a miscategorisation, a rejection they think was
 * unfair, or anything else. Separate from `appealTakedownFor`, which is only for
 * reversing a copyright takedown.
 */
export async function fileEditorialAppealFor(
  author: Author,
  input: { articleId: string; reason: string; justify: string },
): Promise<AppealResult> {
  if (!(EDITORIAL_APPEAL_REASONS as readonly string[]).includes(input.reason)) {
    return { error: "Choose a valid reason.", status: 400 };
  }
  const text = input.justify.trim();
  if (!text) return { error: "Explain the issue so an editor can act on it.", status: 400 };

  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { authorId: true, title: true },
  });
  if (!article) return { error: "Article not found.", status: 404 };
  if (article.authorId !== author.id) return { error: "Not your article.", status: 403 };

  const existing = await prisma.disputeTicket.findFirst({
    where: {
      subject: { startsWith: `${input.articleId} — ` },
      reason: input.reason,
      status: { in: ["open", "under_review"] },
    },
  });
  if (existing) return { error: "You already have an open appeal of this type for this article.", status: 409 };

  // Cap total editorial appeal attempts per article, regardless of reason —
  // prevents indefinite re-filing after each rejection.
  const priorAppealCount = await prisma.disputeTicket.count({
    where: {
      subject: { startsWith: `${input.articleId} — ` },
      reason: { in: [...EDITORIAL_APPEAL_REASONS] },
    },
  });
  if (priorAppealCount >= 2) {
    return { error: "You've reached the maximum of 2 appeals for this article.", status: 409 };
  }

  const [ticket] = await prisma.$transaction([
    prisma.disputeTicket.create({
      data: {
        userId: author.id,
        subject: `${input.articleId} — ${article.title}`,
        reason: input.reason,
        justify: text,
      },
      select: { id: true },
    }),
    prisma.notification.createMany({ data: await staffNotices(`${author.name ?? "An author"} filed an appeal on "${article.title}".`) }),
  ]);

  return { ok: true, id: ticket.id };
}

export interface AppealView {
  id: string;
  articleId: string;
  articleTitle: string;
  kind: "editorial" | "takedown";
  /** editorial: open | under_review | resolved | rejected. takedown: pending | upheld | denied. */
  status: string;
  /** editorial: plagiarism | category | editorial | other. takedown: copyright. */
  reason: string;
  createdAt: string;
  /** Plain outcome once decided: "resolved"/"denied" (editorial), "reinstated"/"denied" (takedown); null while open. */
  resolution: string | null;
}

/** This author's appeals: editorial appeals they filed, and counter-notices on their own articles. */
export async function listAppealsFor(userId: string): Promise<AppealView[]> {
  const articles = await prisma.article.findMany({ where: { authorId: userId }, select: { id: true, title: true } });
  const titles = new Map(articles.map((a) => [a.id, a.title]));
  const [editorial, takedowns] = await Promise.all([
    prisma.disputeTicket.findMany({
      where: { userId, reason: { in: [...EDITORIAL_APPEAL_REASONS] } },
      orderBy: { createdAt: "desc" },
    }),
    articles.length === 0
      ? Promise.resolve([])
      : prisma.disputeTicket.findMany({
          where: {
            reason: "copyright",
            appealStatus: { not: "none" },
            OR: articles.map((a) => ({ subject: { startsWith: `${a.id} — ` } })),
          },
          orderBy: { createdAt: "desc" },
        }),
  ]);

  const titleOf = (subject: string) => {
    const id = articleIdFromSubject(subject);
    return titles.get(id) || subject.split(" — ").slice(1).join(" — ").trim() || "Untitled";
  };
  const views: AppealView[] = [
    ...editorial.map((t) => ({
      id: t.id,
      articleId: articleIdFromSubject(t.subject),
      articleTitle: titleOf(t.subject),
      kind: "editorial" as const,
      status: t.status as string,
      reason: t.reason,
      createdAt: t.createdAt.toISOString(),
      resolution: t.status === "resolved" ? "resolved" : t.status === "rejected" ? "denied" : null,
    })),
    ...takedowns
      .filter((t) => titles.has(articleIdFromSubject(t.subject)))
      .map((t) => ({
        id: t.id,
        articleId: articleIdFromSubject(t.subject),
        articleTitle: titleOf(t.subject),
        kind: "takedown" as const,
        status: t.appealStatus,
        reason: t.reason,
        createdAt: (t.appealedAt ?? t.createdAt).toISOString(),
        resolution: t.appealStatus === "upheld" ? "reinstated" : t.appealStatus === "denied" ? "denied" : null,
      })),
  ];
  return views.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
