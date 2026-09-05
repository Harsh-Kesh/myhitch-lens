import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TrustSafetyHub } from "./TrustSafetyHub";

const EDITORIAL_REASONS = ["plagiarism", "category", "editorial", "other"];

/** Editor/admin: author verification, copyright moderation, and editorial appeals — one hub. */
export default async function TrustSafetyPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (!["editor", "admin"].includes(session.user.role)) redirect("/explore");

  const [rows, appealRows, editorialAppealRows, categories] = await Promise.all([
    prisma.disputeTicket.findMany({
      where: { reason: "copyright", status: { in: ["open", "under_review"] } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { displayName: true } } },
    }),
    prisma.disputeTicket.findMany({
      where: { reason: "copyright", appealStatus: "pending" },
      orderBy: { appealedAt: "asc" },
    }),
    prisma.disputeTicket.findMany({
      where: { reason: { in: EDITORIAL_REASONS }, status: { in: ["open", "under_review"] } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { displayName: true } } },
    }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  function parseSubject(subject: string): { articleId: string; articleTitle: string } {
    const [articleId, ...rest] = subject.split(" — ");
    return { articleId: articleId.trim(), articleTitle: rest.join(" — ") || "(unknown)" };
  }

  const authorIds = new Set<string>();
  const articleByTicket = new Map<
    string,
    { articleId: string; articleTitle: string; authorId: string | null; status: string | null }
  >();
  for (const r of [...rows, ...appealRows, ...editorialAppealRows]) {
    const { articleId, articleTitle } = parseSubject(r.subject);
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { authorId: true, status: true } });
    if (article) authorIds.add(article.authorId);
    articleByTicket.set(r.id, { articleId, articleTitle, authorId: article?.authorId ?? null, status: article?.status ?? null });
  }

  const authors = await prisma.user.findMany({
    where: { id: { in: Array.from(authorIds) } },
    select: { id: true, displayName: true, copyrightStrikes: true, suspended: true },
  });
  const authorById = new Map(authors.map((a) => [a.id, a]));

  const reports = rows.map((r) => {
    const info = articleByTicket.get(r.id)!;
    const author = info.authorId ? authorById.get(info.authorId) : undefined;
    return {
      id: r.id,
      articleId: info.articleId,
      articleTitle: info.articleTitle,
      reporter: r.user.displayName,
      details: r.justify,
      createdAt: r.createdAt.toISOString(),
      authorId: info.authorId,
      authorName: author?.displayName ?? "Unknown",
      authorStrikes: author?.copyrightStrikes ?? 0,
      authorSuspended: author?.suspended ?? false,
    };
  });

  const appeals = appealRows.map((r) => {
    const info = articleByTicket.get(r.id)!;
    const author = info.authorId ? authorById.get(info.authorId) : undefined;
    return {
      id: r.id,
      articleId: info.articleId,
      articleTitle: info.articleTitle,
      appealText: r.appealText ?? "",
      appealedAt: (r.appealedAt ?? r.createdAt).toISOString(),
      authorId: info.authorId,
      authorName: author?.displayName ?? "Unknown",
      authorStrikes: author?.copyrightStrikes ?? 0,
      authorSuspended: author?.suspended ?? false,
    };
  });

  const editorialAppeals = editorialAppealRows.map((r) => {
    const info = articleByTicket.get(r.id)!;
    return {
      id: r.id,
      articleId: info.articleId,
      articleTitle: info.articleTitle,
      articleStatus: info.status ?? "unknown",
      reason: r.reason,
      justify: r.justify,
      createdAt: r.createdAt.toISOString(),
      authorName: r.user.displayName,
    };
  });

  return (
    <TrustSafetyHub
      reports={reports}
      appeals={appeals}
      editorialAppeals={editorialAppeals}
      categories={categories}
    />
  );
}
