import "server-only";

import { prisma } from "@/lib/prisma";

export interface SavedArticle {
  id: string;
  title: string;
  category: string;
  author: string;
}
export interface FollowedAuthor {
  id: string;
  name: string;
}
export interface NotificationView {
  id: string;
  type: string;
  text: string;
  createdAt: string;
}

export interface ReaderSpace {
  saved: SavedArticle[];
  followed: FollowedAuthor[];
  notifications: NotificationView[];
}

/** Everything the Reader dashboard shows, read from the database. */
export async function getReaderSpace(userId: string): Promise<ReaderSpace> {
  const [bookmarks, follows, notifications] = await Promise.all([
    prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            category: { select: { name: true } },
            author: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: { select: { id: true, displayName: true } } },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return {
    saved: bookmarks.map((b) => ({
      id: b.article.id,
      title: b.article.title,
      category: b.article.category.name,
      author: b.article.author.displayName,
    })),
    followed: follows.map((f) => ({ id: f.following.id, name: f.following.displayName })),
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      text: n.text,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export interface AuthorArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  type: string;
  views: number;
  likes: number;
}
export interface AuthorSpace {
  articles: AuthorArticle[];
  totalViews: number;
  totalLikes: number;
  published: number;
}

/** The author's published portfolio + rollup stats, from the database. */
export async function getAuthorSpace(userId: string): Promise<AuthorSpace> {
  const rows = await prisma.article.findMany({
    where: { authorId: userId, status: "published" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      summary: true,
      contentType: true,
      viewsCount: true,
      likesCount: true,
      category: { select: { name: true } },
    },
  });

  return {
    articles: rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      category: r.category.name,
      type: r.contentType,
      views: r.viewsCount,
      likes: r.likesCount,
    })),
    totalViews: rows.reduce((sum, r) => sum + r.viewsCount, 0),
    totalLikes: rows.reduce((sum, r) => sum + r.likesCount, 0),
    published: rows.length,
  };
}
