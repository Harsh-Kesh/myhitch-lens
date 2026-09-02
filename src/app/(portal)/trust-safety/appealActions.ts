"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

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

/**
 * Editor decides a non-copyright editorial appeal (plagiarism flag, category,
 * rejection dispute, other). "resolve" sides with the author and applies
 * whatever remedy fits the appeal's reason; "deny" leaves the original
 * decision standing.
 */
export async function resolveEditorialAppeal(input: {
  ticketId: string;
  decision: "resolve" | "deny";
  note: string;
  newCategoryId?: string;
}): Promise<ActionResult> {
  await requireEditor();
  const note = input.note.trim();
  if (!note) return { error: "A response note is required." };

  const ticket = await prisma.disputeTicket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) return { error: "Appeal not found." };
  if (!["open", "under_review"].includes(ticket.status)) {
    return { error: "This appeal has already been decided." };
  }

  const articleId = articleIdFromSubject(ticket.subject);
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, title: true, status: true },
  });
  if (!article) return { error: "Article not found." };

  if (input.decision === "deny") {
    await prisma.$transaction([
      prisma.disputeTicket.update({ where: { id: ticket.id }, data: { status: "rejected" } }),
      prisma.notification.create({
        data: {
          userId: article.authorId,
          type: "appeal",
          text: `Your appeal for "${article.title}" was reviewed and denied: ${note}`,
        },
      }),
    ]);
    revalidatePath("/trust-safety");
    return { ok: true };
  }

  // decision === "resolve" — apply whatever remedy actually fits the reason.
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.disputeTicket.update({ where: { id: ticket.id }, data: { status: "resolved" } }),
  ];

  let resolutionNote = note;
  if (ticket.reason === "editorial" && article.status === "rejected") {
    ops.push(prisma.article.update({ where: { id: articleId }, data: { status: "in_review" } }));
    resolutionNote += " Your article has been sent back for a fresh editorial review.";
  } else if (ticket.reason === "category" && input.newCategoryId) {
    ops.push(prisma.article.update({ where: { id: articleId }, data: { categoryId: input.newCategoryId } }));
    resolutionNote += " The article's category has been updated.";
  }

  ops.push(
    prisma.notification.create({
      data: {
        userId: article.authorId,
        type: "appeal",
        text: `Your appeal for "${article.title}" was resolved: ${resolutionNote}`,
      },
    }),
  );

  await prisma.$transaction(ops);
  revalidatePath("/trust-safety");
  revalidatePath("/author-dashboard");
  return { ok: true };
}
