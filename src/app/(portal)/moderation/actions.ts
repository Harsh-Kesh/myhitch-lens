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

/** Uphold a copyright report: unpublish the article, strike the author, close the ticket. */
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
      prisma.user.update({ where: { id: article.authorId }, data: { copyrightStrikes: { increment: 1 } } }),
      prisma.notification.create({
        data: {
          userId: article.authorId,
          type: "takedown",
          text: `Your article "${article.title}" was removed following a copyright report. You can appeal this decision from your dashboard.`,
        },
      }),
    ]);
  } else {
    await prisma.disputeTicket.update({ where: { id: ticketId }, data: { status: "resolved" } });
  }

  revalidatePath("/trust-safety");
  revalidatePath("/explore");
  revalidatePath("/author-dashboard");
  return { ok: true };
}

/** Dismiss a copyright report as unfounded. */
export async function dismissReport(ticketId: string): Promise<ActionResult> {
  await requireEditor();
  await prisma.disputeTicket.update({ where: { id: ticketId }, data: { status: "rejected" } });
  revalidatePath("/trust-safety");
  return { ok: true };
}

/** Editor decides a pending appeal: reinstate the article, or uphold the takedown. */
export async function resolveAppeal(ticketId: string, decision: "uphold" | "reinstate"): Promise<ActionResult> {
  await requireEditor();
  const ticket = await prisma.disputeTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Report not found." };
  if (ticket.appealStatus !== "pending") return { error: "This appeal has already been decided." };

  const articleId = articleIdFromSubject(ticket.subject);
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { authorId: true, title: true } });
  if (!article) return { error: "Article not found." };

  if (decision === "reinstate") {
    await prisma.$transaction([
      prisma.disputeTicket.update({ where: { id: ticketId }, data: { appealStatus: "upheld" } }),
      prisma.article.update({ where: { id: articleId }, data: { status: "published" } }),
      // The takedown is reversed — the earlier strike shouldn't stand against the author.
      prisma.user.update({ where: { id: article.authorId }, data: { copyrightStrikes: { decrement: 1 } } }),
      prisma.notification.create({
        data: {
          userId: article.authorId,
          type: "appeal",
          text: `Your appeal for "${article.title}" was upheld — the article is live again.`,
        },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.disputeTicket.update({ where: { id: ticketId }, data: { appealStatus: "denied" } }),
      prisma.notification.create({
        data: {
          userId: article.authorId,
          type: "appeal",
          text: `Your appeal for "${article.title}" was reviewed and denied. The removal stands.`,
        },
      }),
    ]);
  }

  revalidatePath("/trust-safety");
  revalidatePath("/author-dashboard");
  revalidatePath("/explore");
  return { ok: true };
}

/** Suspend an author after repeated copyright violations — blocks new submissions. */
export async function suspendAuthor(userId: string, reason: string): Promise<ActionResult> {
  await requireEditor();
  const text = reason.trim();
  if (!text) return { error: "A reason is required." };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { suspended: true } }),
    prisma.notification.create({
      data: { userId, type: "suspended", text: `Your account was suspended: ${text}` },
    }),
  ]);

  revalidatePath("/trust-safety");
  return { ok: true };
}

/** Lift a suspension. */
export async function unsuspendAuthor(userId: string): Promise<ActionResult> {
  await requireEditor();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { suspended: false } }),
    prisma.notification.create({
      data: { userId, type: "suspended", text: "Your account suspension has been lifted." },
    }),
  ]);
  revalidatePath("/trust-safety");
  return { ok: true };
}
