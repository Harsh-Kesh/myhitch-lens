"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { markAllNotificationsReadFor, markNotificationReadFor } from "@/lib/notifications";

/** Mark one of the current user's own notifications as read. */
export async function markNotificationRead(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  await markNotificationReadFor(session.user.id, id);

  revalidatePath("/", "layout");
}

/** Mark every notification the current user has as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  await markAllNotificationsReadFor(session.user.id);

  revalidatePath("/", "layout");
}
