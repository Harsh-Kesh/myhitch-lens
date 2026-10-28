"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { startReview } from "@/lib/articleReview";
import { prisma } from "@/lib/prisma";
import { mintProvenance } from "@/lib/provenance";

type ActionResult = { ok: true } | { error: string };

async function ownArticle(articleId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Please sign in.", article: null };
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, status: true, destination: true },
  });
  if (!article || article.authorId !== session.user.id) return { error: "Article not found.", article: null };
  return { error: null, article };
}

function refresh() {
  revalidatePath("/submit-article");
  revalidatePath("/author-dashboard");
  revalidatePath("/explore");
}

/** Run the originality review again, after a review that errored (or never started). */
export async function retryReview(articleId: string): Promise<ActionResult> {
  const { article, error } = await ownArticle(articleId);
  if (!article) return { error: error ?? "Article not found." };
  if (article.status !== "in_review") return { error: "Only articles in review can be re-checked." };

  const latest = await prisma.articleReview.findFirst({
    where: { articleId },
    orderBy: { createdAt: "desc" },
    select: { state: true },
  });
  if (latest?.state === "pending") return { error: "A review is already running." };

  await startReview(articleId);
  refresh();
  return { ok: true };
}

/** Make an approved article live. */
export async function publishArticle(articleId: string): Promise<ActionResult> {
  const { article, error } = await ownArticle(articleId);
  if (!article) return { error: error ?? "Article not found." };
  if (article.status !== "approved" && article.status !== "scheduled") {
    return { error: "Only approved articles can be published." };
  }
  if (article.destination === "exchange_hub") {
    return { error: "This article is destined for the Exchange Hub — publish it from there." };
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { status: "published", verified: true, publishedAt: new Date() },
  });
  await mintProvenance(articleId);
  refresh();
  return { ok: true };
}

/** Take a live article offline. It goes back to approved, so it can be published again. */
export async function unpublishArticle(articleId: string): Promise<ActionResult> {
  const { article, error } = await ownArticle(articleId);
  if (!article) return { error: error ?? "Article not found." };
  if (article.status !== "published") return { error: "This article isn't published." };

  await prisma.article.update({ where: { id: articleId }, data: { status: "approved" } });
  refresh();
  return { ok: true };
}
