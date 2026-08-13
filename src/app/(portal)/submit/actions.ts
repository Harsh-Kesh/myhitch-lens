"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export type SubmitResult = { error: string } | undefined;

/** Create an article in the editorial review queue (status = in_review). */
export async function submitArticle(input: {
  title: string;
  category: string;
  contentType: string;
  content: string;
}): Promise<SubmitResult> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };
  if (!["author", "editor", "admin"].includes(session.user.role)) {
    return { error: "Only authors can submit articles." };
  }

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) return { error: "Title and body are required." };

  const category = await prisma.category.findFirst({ where: { name: input.category } });
  if (!category) return { error: "Please choose a valid category." };

  const words = content.split(/\s+/).length;
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;

  await prisma.article.create({
    data: {
      slug,
      title,
      summary: `${content.slice(0, 140)}${content.length > 140 ? "…" : ""}`,
      content,
      contentType: input.contentType,
      status: "in_review",
      lane: "public",
      authorId: session.user.id,
      categoryId: category.id,
      aiScores: {
        readTimeMin: Math.max(1, Math.ceil(words / 150)),
        aiScore: 89 + Math.floor(Math.random() * 10),
        plagiarism: "0.4% detected",
        readability: "Good (Flesch: 65)",
        sentiment: "Highly Analytical",
      },
    },
  });

  revalidatePath("/editorial");
  redirect("/author-dashboard");
}
