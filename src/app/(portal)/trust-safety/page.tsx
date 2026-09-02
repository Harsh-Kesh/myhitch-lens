import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listVerificationQueue } from "@/lib/verification";
import { TrustSafetyHub } from "./TrustSafetyHub";

/** Editor/admin: author verification + copyright moderation, one hub. */
export default async function TrustSafetyPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (!["editor", "admin"].includes(session.user.role)) redirect("/explore");

  const [verificationQueue, rows, appealRows] = await Promise.all([
    listVerificationQueue(),
    prisma.disputeTicket.findMany({
      where: { reason: "copyright", status: { in: ["open", "under_review"] } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { displayName: true } } },
    }),
    prisma.disputeTicket.findMany({
      where: { reason: "copyright", appealStatus: "pending" },
      orderBy: { appealedAt: "asc" },
    }),
  ]);

  function parseSubject(subject: string): { articleId: string; articleTitle: string } {
    const [articleId, ...rest] = subject.split(" — ");
    return { articleId: articleId.trim(), articleTitle: rest.join(" — ") || "(unknown)" };
  }

  const authorIds = new Set<string>();
  const articleByTicket = new Map<string, { articleId: string; articleTitle: string; authorId: string | null }>();
  for (const r of [...rows, ...appealRows]) {
    const { articleId, articleTitle } = parseSubject(r.subject);
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { authorId: true } });
    if (article) authorIds.add(article.authorId);
    articleByTicket.set(r.id, { articleId, articleTitle, authorId: article?.authorId ?? null });
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

  return <TrustSafetyHub verificationQueue={verificationQueue} reports={reports} appeals={appeals} />;
}
