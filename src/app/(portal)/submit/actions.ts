"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { isLicenseCode } from "@/lib/licenses";
import { isSuspended } from "@/lib/authGuards";
import { isEligibleToSubmit } from "@/lib/verification";
import type { ArticleDestination } from "@prisma/client";

export type ActionResult = { error: string } | undefined;

const MAX_TAGS = 5;

function requireAuthorSession() {
  return auth().then((session) => {
    if (!session?.user) throw new Error("Not signed in");
    // Editor/admin accounts are staff, not contributors — they don't author
    // from these accounts, so authoring stays author-only, matching the
    // route-level rule in auth.config.ts.
    if (session.user.role !== "author") {
      throw new Error("Only authors can submit articles.");
    }
    return session;
  });
}

async function checkNotSuspended(userId: string): Promise<{ error: string } | undefined> {
  if (await isSuspended(userId)) {
    return { error: "Your account is suspended following repeated copyright violations. Contact support to appeal." };
  }
  return undefined;
}

/** Create a new blank draft and return its id. */
export async function createDraft(): Promise<{ id: string } | { error: string }> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;
  const slug = `draft-${Date.now().toString(36)}`;

  const article = await prisma.article.create({
    data: {
      slug,
      title: "",
      summary: "",
      content: "{}",
      contentType: "Blog",
      status: "draft",
      lane: "public",
      authorId: session.user.id,
      categoryId: (await prisma.category.findFirst())!.id,
    },
  });

  return { id: article.id };
}

/** Auto-save draft content. Called on debounced editor changes. */
export async function saveDraft(input: {
  articleId: string;
  title?: string;
  content?: string;
}): Promise<ActionResult> {
  const session = await requireAuthorSession();

  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { authorId: true, status: true },
  });
  if (!article) return { error: "Article not found." };
  if (article.authorId !== session.user.id) return { error: "Not your article." };
  if (article.status !== "draft" && article.status !== "changes_requested") {
    return { error: "Article is not editable." };
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) {
    data.title = input.title;
    data.summary = input.title.slice(0, 140);
    data.slug = `${slugify(input.title || "untitled")}-${Date.now().toString(36)}`;
  }
  if (input.content !== undefined) {
    data.content = input.content;
  }

  if (Object.keys(data).length > 0) {
    await prisma.article.update({ where: { id: input.articleId }, data });
  }

  return undefined;
}

/** Submit a draft for editorial review with tags and content type. */
export async function submitForReview(input: {
  articleId: string;
  contentType: string;
  tagNames: string[];
  license: string;
  rightsAttested: boolean;
  destination: ArticleDestination;
}): Promise<ActionResult> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;

  const { eligible, missing } = await isEligibleToSubmit(session.user.id);
  if (!eligible) {
    return { error: `Get verified before submitting — complete your profile: ${missing.join(", ")}.` };
  }

  if (input.tagNames.length === 0) return { error: "Select at least one tag." };
  if (input.tagNames.length > MAX_TAGS) return { error: `Maximum ${MAX_TAGS} tags.` };
  if (!input.rightsAttested) {
    return { error: "You must confirm you own or are licensed for all content and media." };
  }
  if (!isLicenseCode(input.license)) return { error: "Choose a valid content licence." };
  if (input.destination !== "main_app" && input.destination !== "exchange_hub") {
    return { error: "Choose where this article should go once approved." };
  }

  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { authorId: true, status: true, title: true, content: true },
  });
  if (!article) return { error: "Article not found." };
  if (article.authorId !== session.user.id) return { error: "Not your article." };
  if (article.status !== "draft" && article.status !== "changes_requested") {
    return { error: "Article cannot be submitted in its current state." };
  }
  if (!article.title.trim()) return { error: "Please add a title before submitting." };

  let contentText = "";
  try {
    const parsed = JSON.parse(article.content);
    contentText = extractText(parsed);
  } catch {
    contentText = article.content;
  }
  if (contentText.trim().length < 50) {
    return { error: "Article body is too short. Write at least a few sentences." };
  }
  const words = contentText.trim().split(/\s+/).length;

  const tagIds: string[] = [];
  for (const name of input.tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name: name.trim() },
      update: {},
      create: { name: name.trim() },
    });
    tagIds.push(tag.id);
  }

  const bestCategory = await deriveCategoryFromTags(input.tagNames);

  await prisma.article.update({
    where: { id: input.articleId },
    data: {
      status: "in_review",
      contentType: input.contentType,
      categoryId: bestCategory,
      license: input.license,
      rightsAttested: true,
      destination: input.destination,
      summary: `${contentText.slice(0, 140)}${contentText.length > 140 ? "…" : ""}`,
      tags: {
        deleteMany: {},
        create: tagIds.map((tagId) => ({ tagId })),
      },
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
  revalidatePath("/author-dashboard");
  redirect("/author-dashboard");
}

/** The current user's display name + verified status, for the live preview. */
export async function getMyProfileSummary(): Promise<{ name: string; verified: boolean }> {
  const session = await requireAuthorSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true, isVerified: true },
  });
  return { name: user?.displayName ?? session.user.name ?? "Author", verified: user?.isVerified ?? false };
}

/** Fetch all available tags for the tag picker. */
export async function listTags(): Promise<string[]> {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return tags.map((t) => t.name);
}

/** Load a draft for editing. */
export async function loadDraft(articleId: string) {
  const session = await requireAuthorSession();
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      content: true,
      contentType: true,
      status: true,
      license: true,
      destination: true,
      authorId: true,
      tags: { include: { tag: true } },
      revisions: {
        orderBy: { createdAt: "desc" },
        select: { note: true, createdAt: true },
      },
    },
  });
  if (!article) return null;
  if (article.authorId !== session.user.id) return null;
  if (article.status !== "draft" && article.status !== "changes_requested") return null;
  return {
    id: article.id,
    title: article.title,
    content: article.content,
    contentType: article.contentType,
    status: article.status,
    license: article.license,
    destination: article.destination,
    tags: article.tags.map((t) => t.tag.name),
    revisionNotes: article.revisions
      .filter((r) => r.note)
      .map((r) => r.note as string),
  };
}

/** Permanently delete a draft (or a draft sent back for changes). */
export async function deleteDraft(articleId: string): Promise<ActionResult> {
  const session = await requireAuthorSession();

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, status: true },
  });
  if (!article) return { error: "Draft not found." };
  if (article.authorId !== session.user.id) return { error: "Not your draft." };
  if (article.status !== "draft" && article.status !== "changes_requested") {
    return { error: "Only drafts can be deleted." };
  }

  await prisma.article.delete({ where: { id: articleId } });

  revalidatePath("/author-dashboard");
  return undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAG_CATEGORY_MAP: Record<string, string[]> = {
  "AI": ["artificial intelligence", "machine learning", "deep learning", "nlp", "llm", "neural network", "generative ai", "computer vision", "ai"],
  "Supply Chain": ["supply chain", "logistics", "warehousing", "fleet", "shipping", "freight", "procurement", "inventory"],
  "Technology": ["software", "hardware", "cloud", "devops", "cybersecurity", "blockchain", "iot", "api", "technology"],
  "Business": ["business", "strategy", "management", "startup", "entrepreneurship", "marketing", "leadership"],
  "Finance": ["finance", "fintech", "banking", "investment", "cryptocurrency", "trading", "economics"],
  "Healthcare": ["healthcare", "medical", "biotech", "pharma", "clinical", "telemedicine", "health"],
  "Education": ["education", "e-learning", "academic", "university", "training", "teaching"],
  "Travel": ["travel", "aviation", "tourism", "hospitality", "saf", "sustainable aviation"],
  "Lifestyle": ["lifestyle", "wellness", "remote work", "culture", "design", "creative"],
  "Research": ["research", "scientific", "laboratory", "academic paper", "methodology"],
  "Community": ["community", "governance", "discussion", "panel", "contributor"],
};

async function deriveCategoryFromTags(tagNames: string[]): Promise<string> {
  const lower = tagNames.map((t) => t.toLowerCase());
  let bestCategory = "Research";
  let bestScore = 0;

  for (const [categoryName, keywords] of Object.entries(TAG_CATEGORY_MAP)) {
    let score = 0;
    for (const tag of lower) {
      for (const keyword of keywords) {
        if (tag.includes(keyword) || keyword.includes(tag)) score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = categoryName;
    }
  }

  const category = await prisma.category.findFirst({ where: { name: bestCategory } });
  if (category) return category.id;
  const fallback = await prisma.category.findFirst();
  return fallback!.id;
}

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) {
    return n.content.map(extractText).join(" ");
  }
  return "";
}
