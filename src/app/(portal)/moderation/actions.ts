"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ActionResult = { error: string } | { ok: true };

async function requireEditor() {
  const session = await auth();
  if (!session?.user || !["editor", "admin"].includes(session.user.role)) {
    throw new Error("Not authorized");
  }
  return session.user;
}

function articleIdFromSubject(subject: string): string {
  return subject.split(" — ")[0]?.trim() ?? "";
}

/** Uphold a copyright report: unpublish the article and close the ticket. */
export async function removeArticle(ticketId: string): Promise<ActionResult> {
  await requireEditor();
  const ticket = await prisma.disputeTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Report not found." };

  const articleId = articleIdFromSubject(ticket.subject);
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, title: true },
  });

  if (article) {
    await prisma.$transaction([
      prisma.disputeTicket.update({ where: { id: ticketId }, data: { status: "resolved" } }),
      prisma.article.update({ where: { id: articleId }, data: { status: "rejected" } }),
      prisma.notification.create({
        data: {
          userId: article.authorId,
          type: "takedown",
          text: `Your article "${article.title}" was removed following a copyright report.`,
        },
      }),
    ]);
  } else {
    await prisma.disputeTicket.update({ where: { id: ticketId }, data: { status: "resolved" } });
  }

  revalidatePath("/moderation");
  revalidatePath("/explore");
  return { ok: true };
}

/** Dismiss a copyright report as unfounded. */
export async function dismissReport(ticketId: string): Promise<ActionResult> {
  await requireEditor();
  await prisma.disputeTicket.update({ where: { id: ticketId }, data: { status: "rejected" } });
  revalidatePath("/moderation");
  return { ok: true };
}
