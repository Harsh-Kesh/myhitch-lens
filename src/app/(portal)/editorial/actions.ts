"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireEditor() {
  const session = await auth();
  if (!session?.user || !["editor", "admin"].includes(session.user.role)) {
    throw new Error("Not authorized");
  }
  return session.user;
}

/** Approve a submission and make it live (optionally at a chosen date). */
export async function approveAndPublish(articleId: string, scheduleISO?: string): Promise<void> {
  await requireEditor();
  const when = scheduleISO ? new Date(scheduleISO) : new Date();
  const publishAt = Number.isNaN(when.getTime()) ? new Date() : when;

  await prisma.article.update({
    where: { id: articleId },
    data: { status: "published", verified: true, publishedAt: publishAt },
  });

  revalidatePath("/editorial");
  revalidatePath("/explore");
}

/** Send a submission back to the author with revision notes. */
export async function requestRevisions(articleId: string, note: string, editorName: string): Promise<void> {
  const editor = await requireEditor();
  const text = note.trim();
  if (!text) throw new Error("Revision note required");

  await prisma.$transaction([
    prisma.article.update({ where: { id: articleId }, data: { status: "changes_requested" } }),
    prisma.revision.create({
      data: { articleId, editorId: editor.id, note: `[${editorName}] ${text}` },
    }),
  ]);

  revalidatePath("/editorial");
}

/** Reject a submission outright. */
export async function rejectSubmission(articleId: string): Promise<void> {
  await requireEditor();
  await prisma.article.update({ where: { id: articleId }, data: { status: "rejected" } });
  revalidatePath("/editorial");
}
