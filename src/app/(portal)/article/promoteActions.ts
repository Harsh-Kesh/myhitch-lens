"use server";

import { auth } from "@/auth";
import { takeAiSlot } from "@/lib/aiClient";
import { isSuspended } from "@/lib/authGuards";
import { prisma } from "@/lib/prisma";
import { generateSocialPosts, type SocialPosts } from "@/lib/socialPosts";
import { MAX_TRANSLATE_CHARS, translateArticleText, type Translation } from "@/lib/translate";
import { languageLabel } from "@/lib/translationLanguages";
import { articleJsonToText } from "@/lib/writingCheck";

/**
 * Promotion tools for an article's own author: social posts and translation.
 * Both only produce text for the author to copy; nothing is posted or saved.
 */

type Loaded = { title: string; summary: string; text: string; userId: string };

async function loadOwnArticle(articleId: string): Promise<Loaded | { error: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };
  if (await isSuspended(session.user.id)) {
    return { error: "Your account is suspended following repeated copyright violations. Contact support to appeal." };
  }

  const article = await prisma.article.findUnique({
    where: { id: String(articleId) },
    select: { authorId: true, title: true, summary: true, content: true },
  });
  // Same answer for "missing" and "not yours", so ids can't be probed.
  if (!article || article.authorId !== session.user.id) return { error: "Only the author can use these tools." };

  const text = articleJsonToText(article.content) || article.content;
  if (text.trim().split(/\s+/).length < 20) return { error: "The article is too short for this yet." };
  return { title: article.title, summary: article.summary, text, userId: session.user.id };
}

/** Ready-to-copy posts for LinkedIn, Facebook, Instagram and X. */
export async function createSocialPosts(articleId: string): Promise<{ error: string } | { posts: SocialPosts }> {
  const loaded = await loadOwnArticle(articleId);
  if ("error" in loaded) return loaded;

  const slot = takeAiSlot(loaded.userId, "social");
  if (!slot.ok) return { error: slot.error };

  try {
    return { posts: await generateSocialPosts(loaded.title, loaded.summary, loaded.text) };
  } catch (err) {
    console.error("[createSocialPosts]", err);
    return { error: err instanceof Error ? err.message : "Couldn't write the posts. Please try again." };
  }
}

/** The article's title and body in another language. */
export async function translateOwnArticle(
  articleId: string,
  languageCode: string,
): Promise<{ error: string } | { translation: Translation; language: string }> {
  const language = languageLabel(String(languageCode));
  if (!language) return { error: "Choose a language to translate into." };

  const loaded = await loadOwnArticle(articleId);
  if ("error" in loaded) return loaded;
  if (loaded.text.length > MAX_TRANSLATE_CHARS) {
    return { error: "This article is too long to translate in one go. Translate it in sections." };
  }

  // Translations are the longest requests, so keep this one tighter than the others.
  const slot = takeAiSlot(loaded.userId, "translate", { dailyLimit: 20, cooldownMs: 8_000 });
  if (!slot.ok) return { error: slot.error };

  try {
    return { translation: await translateArticleText(loaded.title, loaded.text, languageCode), language };
  } catch (err) {
    console.error("[translateOwnArticle]", err);
    return { error: err instanceof Error ? err.message : "The translation failed. Please try again." };
  }
}
