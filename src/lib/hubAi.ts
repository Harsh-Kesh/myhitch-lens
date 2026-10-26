import "server-only";

import { NextResponse } from "next/server";

import { takeAiSlot } from "@/lib/aiClient";
import { companyArticleWhere } from "@/lib/companyArticles";
import { hubError, HubError, need, type HubCompany } from "@/lib/hubCompany";
import { countWords, findPlaceholders, reviewContent, type ChecklistItem } from "@/lib/preSubmitCheck";
import { prisma } from "@/lib/prisma";
import {
  isRewriteAction,
  MAX_INSTRUCTION_CHARS,
  MAX_REWRITE_CHARS,
  MIN_INSTRUCTION_CHARS,
  rewriteText,
} from "@/lib/rewrite";
import { generateSocialPosts } from "@/lib/socialPosts";
import { suggestTitleAndExcerpt } from "@/lib/titleExcerpt";
import { MAX_TRANSLATE_CHARS, translateArticleText } from "@/lib/translate";
import { languageLabel, TRANSLATION_LANGUAGES } from "@/lib/translationLanguages";
import { articleJsonToText, checkWriting, MIN_CHECK_WORDS } from "@/lib/writingCheck";

/**
 * Lens's AI writing tools for the MYHitch app (through the hub). The same AI
 * functions, limits and messages as the website's editor
 * (src/app/(portal)/submit/actions.ts) and promotion tools
 * (src/app/(portal)/article/promoteActions.ts). The app sends plain text
 * (paragraphs split by blank lines), not the editor's TipTap JSON.
 */

/** ANTHROPIC_API_KEY isn't set on this deployment. */
export class AiNotConfigured extends Error {}

/** hubError, plus 503 { code: "ai_not_configured" } when the AI tools are off. */
export function aiError(e: unknown): NextResponse {
  if (e instanceof AiNotConfigured) {
    return NextResponse.json(
      { code: "ai_not_configured", error: "Lens's AI writing tools aren't switched on yet." },
      { status: 503 },
    );
  }
  return hubError(e);
}

/** Someone who can write, on a deployment with the AI tools switched on. */
function needAi(ctx: HubCompany) {
  need(ctx, "write");
  if (!process.env.ANTHROPIC_API_KEY) throw new AiNotConfigured();
}

function slot(ctx: HubCompany, feature: string, opts?: { dailyLimit?: number; cooldownMs?: number }) {
  const taken = takeAiSlot(ctx.user.id, feature, opts);
  if (!taken.ok) throw new HubError(429, taken.error);
}

/** The AI call failed: its message (the AI libs throw readable ones), or a fallback. */
function failed(err: unknown, where: string, fallback: string): never {
  console.error(`[hub ${where}]`, err);
  throw new HubError(502, err instanceof Error && err.message ? err.message : fallback);
}

/** The app's plain text: one paragraph per block, as the editor's text would be. */
function plain(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n");
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function languages(ctx: HubCompany) {
  needAi(ctx);
  return { languages: TRANSLATION_LANGUAGES.map((l) => ({ code: l.code, label: l.label })) };
}

export async function check(ctx: HubCompany, input: { title?: unknown; content?: unknown }) {
  needAi(ctx);
  const text = plain(input.content);
  if (words(text) < MIN_CHECK_WORDS) {
    throw new HubError(400, `Write at least ${MIN_CHECK_WORDS} words before running a writing check.`);
  }
  slot(ctx, "writing-check");
  try {
    const result = await checkWriting(text);
    return { summary: result.summary, issues: result.issues, truncated: result.truncated };
  } catch (err) {
    failed(err, "ai/check", "Writing check failed. Please try again.");
  }
}

export async function rewrite(ctx: HubCompany, input: { text?: unknown; action?: unknown; instruction?: unknown }) {
  needAi(ctx);
  const action = input.action;
  if (!isRewriteAction(action)) throw new HubError(400, "Choose a rewrite option.");
  const wanted = String(input.instruction ?? "").replace(/\s+/g, " ").trim();
  if (action === "custom" && wanted.length < MIN_INSTRUCTION_CHARS) {
    throw new HubError(400, "Type what you want the AI to change, in a few words.");
  }
  if (wanted.length > MAX_INSTRUCTION_CHARS) {
    throw new HubError(400, `Keep your instruction under ${MAX_INSTRUCTION_CHARS} characters.`);
  }
  const passage = String(input.text ?? "").trim();
  if (words(passage) < 3) throw new HubError(400, "Select a few more words to rewrite.");
  if (passage.length > MAX_REWRITE_CHARS) {
    throw new HubError(
      400,
      `That selection is too long to rewrite at once. Select up to about ${Math.round(MAX_REWRITE_CHARS / 6)} words.`,
    );
  }
  // Rewriting is iterative (try, tweak, try again), so a quicker cadence than the other tools.
  slot(ctx, "rewrite", { dailyLimit: 100, cooldownMs: 1_500 });
  try {
    return { text: await rewriteText(passage, action, wanted) };
  } catch (err) {
    failed(err, "ai/rewrite", "Rewrite failed. Please try again.");
  }
}

export async function titleAndExcerpt(ctx: HubCompany, input: { title?: unknown; content?: unknown }) {
  needAi(ctx);
  const text = plain(input.content);
  if (words(text) < MIN_CHECK_WORDS) {
    throw new HubError(400, `Write at least ${MIN_CHECK_WORDS} words before asking for title and excerpt ideas.`);
  }
  slot(ctx, "title-excerpt");
  try {
    const result = await suggestTitleAndExcerpt(text, String(input.title ?? "").slice(0, 300));
    return { titles: result.titles, excerpt: result.excerpt };
  } catch (err) {
    failed(err, "ai/title", "Suggestions failed. Please try again.");
  }
}

/**
 * The website's pre-submit checklist, for what a company article in the app
 * has: title, body, leftover placeholders and the AI content review. Tags,
 * excerpt, image alt text, rights and the website's own submission rules don't
 * apply to it (the company's own reviewers approve it), so they're left out.
 */
export async function checklist(ctx: HubCompany, input: { title?: unknown; content?: unknown }) {
  needAi(ctx);
  const title = String(input.title ?? "").trim();
  const text = plain(input.content);
  const count = countWords(text);
  const items: ChecklistItem[] = [];

  if (!title) items.push({ id: "title", status: "fail", label: "Add a title" });
  else if (title.length < 10 || title.length > 100)
    items.push({
      id: "title",
      status: "warn",
      label: "Title length",
      detail: `Your title is ${title.length} characters. Between 10 and 100 reads best on cards.`,
    });
  else items.push({ id: "title", status: "pass", label: "Title is set" });

  if (text.length < 50) items.push({ id: "body", status: "fail", label: "Article body is too short", detail: "Write at least a few sentences." });
  else if (count < 100)
    items.push({ id: "body", status: "warn", label: "Short article", detail: `${count} words. Most published articles are longer than 100.` });
  else items.push({ id: "body", status: "pass", label: `Article body (${count} words)` });

  const placeholders = findPlaceholders(`${title}\n${text}`);
  items.push(
    placeholders.length
      ? { id: "placeholders", status: "fail", label: "Leftover placeholder text", detail: `Found ${placeholders.join(", ")}. Replace or remove it.` }
      : { id: "placeholders", status: "pass", label: "No leftover placeholder text" },
  );

  if (count < 20) {
    items.push({ id: "ai-review", status: "warn", label: "AI content review skipped", detail: "Write at least 20 words first." });
  } else {
    const taken = takeAiSlot(ctx.user.id, "presubmit-review");
    if (!taken.ok) {
      items.push({ id: "ai-review", status: "warn", label: "AI content review skipped", detail: taken.error });
    } else {
      try {
        const concerns = await reviewContent(text, title);
        items.push(
          concerns.length === 0
            ? { id: "ai-review", status: "pass", label: "AI content review: no concerns found" }
            : {
                id: "ai-review",
                status: "warn",
                label: `AI content review: ${concerns.length} thing${concerns.length === 1 ? "" : "s"} to check`,
                detail: "An editor will review your article too. Fix anything that is a genuine problem.",
                notes: concerns.map((c) => `${c.category}${c.quote ? ` — “${c.quote}”` : ""}: ${c.reason}`),
              },
        );
      } catch (err) {
        console.error("[hub ai/checklist] AI review failed", err);
        items.push({ id: "ai-review", status: "warn", label: "AI content review couldn't run", detail: "Try again in a moment." });
      }
    }
  }
  return { items };
}

// ---------------------------------------------------------------------------
// Promotion: published articles of the caller's company (owner: any of them; author: their own)
// ---------------------------------------------------------------------------

async function publishedArticle(ctx: HubCompany, id: string) {
  const article = await prisma.article.findFirst({
    where: { id, ...companyArticleWhere(ctx.membership.orgId) },
    select: { authorId: true, title: true, summary: true, content: true, status: true },
  });
  // Same answer for "missing" and "not yours", so ids can't be probed.
  if (!article || (!ctx.membership.isAdmin && article.authorId !== ctx.user.id)) throw new HubError(404, "Article not found.");
  if (article.status !== "published") throw new HubError(400, "Only published articles can be promoted or translated.");
  const text = articleJsonToText(article.content) || article.content;
  if (words(text) < 20) throw new HubError(400, "The article is too short for this yet.");
  return { title: article.title, summary: article.summary, text };
}

export async function socialPosts(ctx: HubCompany, articleId: string) {
  needAi(ctx);
  const article = await publishedArticle(ctx, articleId);
  slot(ctx, "social");
  try {
    const posts = await generateSocialPosts(article.title, article.summary, article.text);
    return { linkedin: posts.linkedin, facebook: posts.facebook, instagram: posts.instagram, x: posts.x };
  } catch (err) {
    failed(err, "social", "Couldn't write the posts. Please try again.");
  }
}

export async function translate(ctx: HubCompany, articleId: string, input: { language?: unknown }) {
  needAi(ctx);
  const code = String(input.language ?? "");
  if (!languageLabel(code)) throw new HubError(400, "Choose a language to translate into.");
  const article = await publishedArticle(ctx, articleId);
  if (article.text.length > MAX_TRANSLATE_CHARS) {
    throw new HubError(400, "This article is too long to translate in one go. Translate it in sections.");
  }
  // Translations are the longest requests, so this one is kept tighter than the others.
  slot(ctx, "translate", { dailyLimit: 20, cooldownMs: 8_000 });
  try {
    const translation = await translateArticleText(article.title, article.text, code);
    return { title: translation.title, text: translation.text };
  } catch (err) {
    failed(err, "translate", "The translation failed. Please try again.");
  }
}
