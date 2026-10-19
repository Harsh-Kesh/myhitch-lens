import "server-only";

import { prisma } from "@/lib/prisma";

export interface NotificationView {
  id: string;
  type: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface MyNotifications {
  items: NotificationView[];
  unreadCount: number;
}

/** The current user's own notifications — every role, one shared surface. */
export async function getMyNotifications(userId: string, limit = 20): Promise<MyNotifications> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return {
    items: rows.map((n) => ({
      id: n.id,
      type: n.type,
      text: n.text,
      createdAt: n.createdAt.toISOString(),
      read: n.read,
    })),
    unreadCount,
  };
}

/** Mark one of this user's own notifications as read. False when it isn't theirs (or doesn't exist). */
export async function markNotificationReadFor(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  return count > 0;
}

/** Mark every notification this user has as read. */
export async function markAllNotificationsReadFor(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
