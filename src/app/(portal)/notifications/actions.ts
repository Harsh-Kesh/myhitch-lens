"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Mark one of the current user's own notifications as read. */
export async function markNotificationRead(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  });

  revalidatePath("/", "layout");
}

/** Mark every notification the current user has as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/", "layout");
}
