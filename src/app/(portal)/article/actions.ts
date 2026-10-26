"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { appealTakedownFor, fileEditorialAppealFor, type EditorialAppealReason as Reason } from "@/lib/appeals";
import { countArticleShare, countArticleView } from "@/lib/articleStats";
import { prisma } from "@/lib/prisma";
import { syncContributorRank } from "@/lib/ranking";

/**
 * Record a read: increment the article's view counter and log an analytics
 * event. The author's own views are ignored so metrics stay honest. Called
 * once per session per article from the client (deduped there). The counting
 * is shared with the MYHitch app (src/lib/articleStats.ts).
 */
export async function recordArticleView(articleId: string): Promise<void> {
  const session = await auth();
  await countArticleView(articleId, session?.user?.id ?? null);
}

/**
 * Record a share (Web Share API completed, or the link was copied). Same
 * anti-gaming exclusion as recordArticleView — the author can't inflate their
 * own count — and it counts toward the author's contributor ranking.
 */
export async function recordArticleShare(articleId: string): Promise<void> {
  const session = await auth();
  await countArticleShare(articleId, session?.user?.id ?? null);
}

/** File a copyright/infringement report against an article → moderation queue. */
export async function reportCopyright(
  articleId: string,
  details: string,
): Promise<{ error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user) return { error: "Please sign in to report." };
  const text = details.trim();
  if (!text) return { error: "Describe the issue so a moderator can act on it." };

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { title: true },
  });
  if (!article) return { error: "Article not found." };

  await prisma.$transaction([
    prisma.disputeTicket.create({
      data: {
        userId: session.user.id,
        subject: `${articleId} — ${article.title}`,
        reason: "copyright",
        justify: text,
      },
    }),
    prisma.notification.createMany({
      data: (
        await prisma.user.findMany({ where: { role: { in: ["editor", "admin"] } }, select: { id: true } })
      ).map((u) => ({
        userId: u.id,
        type: "copyright_report",
        text: `Copyright report filed against "${article.title}".`,
      })),
    }),
  ]);

  return { ok: true };
}

/** Author files a counter-notice against a copyright takedown of their article. */
export async function appealTakedown(
  articleId: string,
  appealText: string,
): Promise<{ error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user) return { error: "Please sign in." };
  const result = await appealTakedownFor({ id: session.user.id, name: session.user.name }, articleId, appealText);
  if ("error" in result) return { error: result.error };
  return { ok: true };
}

export type EditorialAppealReason = Reason;

/**
 * Author disputes a non-copyright editorial call on their own article — an
 * inaccurate plagiarism flag, a miscategorisation, a rejection they think was
 * unfair, or anything else. Separate from `appealTakedown`, which is only for
 * reversing a copyright takedown. The rules are in src/lib/appeals.ts.
 */
export async function fileEditorialAppeal(input: {
  articleId: string;
  reason: EditorialAppealReason;
  justify: string;
}): Promise<{ error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user) return { error: "Please sign in." };
  const result = await fileEditorialAppealFor({ id: session.user.id, name: session.user.name }, input);
  if ("error" in result) return { error: result.error };

  revalidatePath("/author-dashboard");
  return { ok: true };
}

/** Toggle the current user's like on an article and keep the counter in sync. */
export async function toggleLike(articleId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const userId = session.user.id;

  const [existing, article] = await Promise.all([
    prisma.like.findUnique({ where: { userId_articleId: { userId, articleId } } }),
    prisma.article.findUnique({ where: { id: articleId }, select: { authorId: true } }),
  ]);
  if (!article) return;

  if (existing) {
    await prisma.$transaction([
      prisma.like.delete({ where: { userId_articleId: { userId, articleId } } }),
      prisma.article.update({ where: { id: articleId }, data: { likesCount: { decrement: 1 } } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.like.create({ data: { userId, articleId } }),
      prisma.article.update({ where: { id: articleId }, data: { likesCount: { increment: 1 } } }),
    ]);
  }
  await syncContributorRank(article.authorId);

  revalidatePath("/article");
  revalidatePath("/explore");
}

/** Toggle the current user's bookmark on an article. */
export async function toggleBookmark(articleId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const userId = session.user.id;

  const existing = await prisma.bookmark.findUnique({
    where: { userId_articleId: { userId, articleId } },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { userId_articleId: { userId, articleId } } });
  } else {
    await prisma.bookmark.create({ data: { userId, articleId } });
  }

  revalidatePath("/article");
  revalidatePath("/reader-dashboard");
}

/** Follow / unfollow an author from the article page. */
export async function toggleFollow(authorId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const followerId = session.user.id;
  if (followerId === authorId) return; // can't follow yourself

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: authorId } },
  });
  if (existing) {
    await prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId: authorId } },
    });
  } else {
    await prisma.follow.create({ data: { followerId, followingId: authorId } });
  }

  revalidatePath("/article");
  revalidatePath("/reader-dashboard");
}

/** Post a comment as the current user. */
export async function postComment(articleId: string, text: string): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return;
  const body = text.trim();
  if (!body) return;

  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { authorId: true } });
  if (!article) return { error: "Article not found." };
  if (article.authorId === session.user.id) {
    return { error: "You can't comment on your own article." };
  }

  await prisma.comment.create({
    data: { articleId, userId: session.user.id, text: body },
  });
  await syncContributorRank(article.authorId);
  revalidatePath("/article");
}
