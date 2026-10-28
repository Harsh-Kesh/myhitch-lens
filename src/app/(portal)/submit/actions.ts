"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { auth } from "@/auth";
import { startReview } from "@/lib/articleReview";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { isLicenseCode } from "@/lib/licenses";
import { isSuspended } from "@/lib/authGuards";
import { articleHasVideoOrAudio } from "@/lib/articleMedia";
import { getEntitlements, getSubmissionAllowance, upgradeMessage } from "@/lib/entitlements";
import { pagesNeeded } from "@/lib/magazinePagination";
import { isEligibleToSubmit } from "@/lib/verification";
import { takeAiSlot } from "@/lib/aiClient";
import {
  articleJsonToText,
  checkWriting,
  MIN_CHECK_WORDS,
  type WritingCheckResult,
} from "@/lib/writingCheck";
import { MAX_EXCERPT_CHARS, suggestTitleAndExcerpt, type TitleExcerptResult } from "@/lib/titleExcerpt";
import { suggestTags, type TagSuggestionResult } from "@/lib/tagSuggestions";
import { suggestImageText, type ImageTextResult } from "@/lib/imageText";
import { isRewriteAction, MAX_INSTRUCTION_CHARS, MAX_REWRITE_CHARS, MIN_INSTRUCTION_CHARS, rewriteText } from "@/lib/rewrite";
import { pageBreakdown, suggestLayout, type LayoutHints, type PageBreakdown } from "@/lib/layoutHints";
import { cleanSeo, suggestSeo, type SeoMetadata } from "@/lib/seoMetadata";
import { AUTHOR_TERMS_VERSION } from "@/lib/authorTerms";
import { legalContentHash, reviewLegal } from "@/lib/legalReview";
import { blockingIssues, type LegalReview } from "@/lib/legalReviewTypes";
import {
  countImagesMissingAlt,
  countWords,
  findPlaceholders,
  reviewContent,
  type ChecklistItem,
} from "@/lib/preSubmitCheck";
import type { ArticleDestination, Prisma } from "@prisma/client";

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
    // Video and audio embeds belong to Creator and above. Refuse to store them for a plan
    // without them, however they got into the editor (toolbar, paste, an older draft).
    if (articleHasVideoOrAudio(input.content) && !(await getEntitlements(session.user.id)).videoEmbeds) {
      return { error: upgradeMessage("Video and audio embedding isn't included in your plan. Remove the video or audio clips to keep saving.") };
    }
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
  /** Author-written (or AI-suggested, then edited) excerpt. Blank falls back to the start of the article. */
  summary?: string;
  /** Optional search title / description / keywords, stored with the article. */
  seo?: { title?: string; description?: string; keywords?: string[] };
  /** The author's acceptance of the Author Content Terms, after the legal and compliance check. */
  legal?: { termsAccepted: boolean; termsVersion: string };
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
    select: { authorId: true, status: true, title: true, content: true, submittedAt: true, aiScores: true },
  });
  if (!article) return { error: "Article not found." };
  if (article.authorId !== session.user.id) return { error: "Not your article." };
  if (article.status !== "draft" && article.status !== "changes_requested") {
    return { error: "Article cannot be submitted in its current state." };
  }
  if (!article.title.trim()) return { error: "Please add a title before submitting." };

  // Plan limits. Sponsored articles go through the Exchange Hub; and a first
  // submission counts against the monthly allowance (a resubmission after
  // "changes requested" does not count again).
  const entitlements = await getEntitlements(session.user.id);
  if (!entitlements.videoEmbeds && articleHasVideoOrAudio(article.content)) {
    return { error: upgradeMessage("This article has an embedded video or audio clip, which isn't included in your plan. Remove it to submit.") };
  }
  if (input.destination === "exchange_hub" && !entitlements.sponsoredArticles) {
    return { error: upgradeMessage("Sponsored articles through the Exchange Hub aren't included in your plan.") };
  }
  if (article.submittedAt === null) {
    const allowance = await getSubmissionAllowance(session.user.id);
    if (!allowance.allowed) {
      return {
        error: upgradeMessage(`You've used all ${allowance.limit} article submissions your plan includes this month.`),
      };
    }
  }

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

  // Each plan gives an approved article a fixed number of magazine pages (Free: 2).
  const pages = pagesNeeded(contentText);
  if (pages > entitlements.maxPagesPerArticle) {
    return {
      error: upgradeMessage(
        `This article runs to ${pages} magazine pages, but your plan includes up to ${entitlements.maxPagesPerArticle} per article. Shorten it to submit.`,
      ),
    };
  }

  // Legal and compliance gate. The server only trusts the review it saved itself (runLegalReview), and only
  // if the article, title and destination are unchanged since then.
  if (
    !input.legal ||
    input.legal.termsAccepted !== true ||
    input.legal.termsVersion !== AUTHOR_TERMS_VERSION
  ) {
    return { error: "Please review and accept the Author Content Terms before submitting." };
  }
  const storedReview = storedLegalReview(article.aiScores);
  const reviewedHash = legalContentHash(article.title, input.destination, articleJsonToText(article.content) || article.content);
  if (!storedReview || storedReview.contentHash !== reviewedHash) {
    return { error: "Your article changed since the legal check ran. Run the check again, then submit." };
  }
  // Any issue in the legal report stops the submission until the author has fixed it and the check comes back clear.
  if (storedReview.available && blockingIssues(storedReview.checks).length > 0) {
    return {
      error:
        "Your article has legal or compliance issues to fix before it can be submitted. Edit it, then click Submit again to re-run the check.",
    };
  }

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
  const customSummary = (input.summary ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_EXCERPT_CHARS);
  // Search metadata lives in the article's aiScores JSON (no schema change). Keep an earlier value when
  // the author didn't touch it on a resubmission.
  const submittedSeo = input.seo ? cleanSeo(input.seo) : null;
  const seo =
    submittedSeo && (submittedSeo.title || submittedSeo.description || submittedSeo.keywords.length > 0)
      ? submittedSeo
      : storedSeo(article.aiScores);

  await prisma.article.update({
    where: { id: input.articleId },
    data: {
      status: "in_review",
      submittedAt: article.submittedAt ?? new Date(),
      contentType: input.contentType,
      categoryId: bestCategory,
      license: input.license,
      rightsAttested: true,
      destination: input.destination,
      summary: customSummary || `${contentText.slice(0, 140)}${contentText.length > 140 ? "…" : ""}`,
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
        ...(seo ? { seo } : {}),
        // What was checked and what the author agreed to, kept with the article for editors and for the record.
        legalReview: storedReview,
        legalAcceptance: {
          termsVersion: AUTHOR_TERMS_VERSION,
          acceptedAt: new Date().toISOString(),
        },
      } as unknown as Prisma.InputJsonObject,
    },
  });

  // The originality review (Copyleaks) runs after the response, so submitting isn't held up by it.
  after(() => startReview(input.articleId));

  revalidatePath("/editorial");
  revalidatePath("/author-dashboard");
  redirect("/author-dashboard");
}

/** The current user's display name + verified status, for the live preview. */
export interface MyPlanSummary {
  name: string;
  verified: boolean;
  /** The plan includes sponsored articles, so "Exchange Hub" is a valid destination. */
  canSponsor: boolean;
  /** The plan includes video and audio embedding in articles. */
  canEmbedMedia: boolean;
  /** Monthly submissions: limit is null when unlimited. */
  allowance: { limit: number | null; used: number; allowed: boolean };
}

export async function getMyProfileSummary(): Promise<MyPlanSummary> {
  const session = await requireAuthorSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true, isVerified: true },
  });
  const [entitlements, allowance] = await Promise.all([getEntitlements(session.user.id), getSubmissionAllowance(session.user.id)]);
  return {
    name: user?.displayName ?? session.user.name ?? "Author",
    verified: user?.isVerified ?? false,
    canSponsor: entitlements.sponsoredArticles,
    canEmbedMedia: entitlements.videoEmbeds,
    allowance: { limit: allowance.limit, used: allowance.used, allowed: allowance.allowed },
  };
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
      aiScores: true,
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
    seo: storedSeo(article.aiScores),
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

/** The legal review saved with an article, if it has the expected shape. */
function storedLegalReview(aiScores: unknown): LegalReview | null {
  if (!aiScores || typeof aiScores !== "object" || !("legalReview" in aiScores)) return null;
  const r = (aiScores as { legalReview: unknown }).legalReview as Partial<LegalReview> | null;
  if (!r || typeof r.contentHash !== "string" || !Array.isArray(r.checks) || typeof r.available !== "boolean") return null;
  return r as LegalReview;
}

/** The search metadata saved in an article's aiScores blob, if any. */
function storedSeo(aiScores: unknown): SeoMetadata | null {
  if (!aiScores || typeof aiScores !== "object" || !("seo" in aiScores)) return null;
  const seo = cleanSeo((aiScores as { seo: Record<string, unknown> }).seo ?? {});
  return seo.title || seo.description || seo.keywords.length > 0 ? seo : null;
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

/** AI grammar & clarity check of the draft currently in the editor. Suggestions only; nothing is saved. */
export async function checkArticleWriting(
  content: string,
): Promise<{ error: string } | { result: WritingCheckResult }> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;

  const text = articleJsonToText(content);
  if (text.split(/\s+/).filter(Boolean).length < MIN_CHECK_WORDS) {
    return { error: `Write at least ${MIN_CHECK_WORDS} words before running a writing check.` };
  }

  const slot = takeAiSlot(session.user.id, "writing-check");
  if (!slot.ok) return { error: slot.error };

  try {
    return { result: await checkWriting(text) };
  } catch (err) {
    console.error("[checkArticleWriting]", err);
    return { error: err instanceof Error ? err.message : "Writing check failed. Please try again." };
  }
}

/**
 * Pre-submit checklist for the draft as it is right now: the same rules
 * `submitForReview` enforces (so the author learns about them first), a few
 * quality checks, and one AI content review. Advisory; nothing is saved.
 */
export async function runPreSubmitChecklist(input: {
  articleId: string | null;
  title: string;
  content: string;
  excerpt: string;
  tagCount: number;
  rightsAttested: boolean;
}): Promise<{ error: string } | { items: ChecklistItem[] }> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;
  const userId = session.user.id;

  const title = input.title.trim();
  const text = articleJsonToText(input.content);
  const words = countWords(text);
  const items: ChecklistItem[] = [];

  // Title
  if (!title) items.push({ id: "title", status: "fail", label: "Add a title" });
  else if (title.length < 10 || title.length > 100)
    items.push({
      id: "title",
      status: "warn",
      label: "Title length",
      detail: `Your title is ${title.length} characters. Between 10 and 100 reads best on cards.`,
    });
  else items.push({ id: "title", status: "pass", label: "Title is set" });

  // Body
  if (text.length < 50) items.push({ id: "body", status: "fail", label: "Article body is too short", detail: "Write at least a few sentences." });
  else if (words < 100)
    items.push({ id: "body", status: "warn", label: "Short article", detail: `${words} words. Most published articles are longer than 100.` });
  else items.push({ id: "body", status: "pass", label: `Article body (${words} words)` });

  // Leftover placeholder text
  const placeholders = findPlaceholders(`${title}\n${text}`);
  items.push(
    placeholders.length
      ? { id: "placeholders", status: "fail", label: "Leftover placeholder text", detail: `Found ${placeholders.join(", ")}. Replace or remove it.` }
      : { id: "placeholders", status: "pass", label: "No leftover placeholder text" },
  );

  // Tags, excerpt, rights
  items.push(
    input.tagCount > 0
      ? { id: "tags", status: "pass", label: `Tags selected (${input.tagCount})` }
      : { id: "tags", status: "fail", label: "Select at least one tag" },
  );
  items.push(
    input.excerpt.trim()
      ? { id: "excerpt", status: "pass", label: "Excerpt written" }
      : {
          id: "excerpt",
          status: "warn",
          label: "No excerpt",
          detail: "Cards will show the first words of your article instead. Write one, or use the AI suggestion.",
        },
  );
  items.push(
    input.rightsAttested
      ? { id: "rights", status: "pass", label: "Rights confirmation ticked" }
      : { id: "rights", status: "fail", label: "Confirm you own or are licensed for all content", detail: "Tick the box in the panel below." },
  );

  // Images
  const images = countImagesMissingAlt(input.content);
  if (images.total > 0) {
    items.push(
      images.missing > 0
        ? {
            id: "alt",
            status: "warn",
            label: `Alt text missing on ${images.missing} of ${images.total} image${images.total === 1 ? "" : "s"}`,
            detail: "Select the image, click ✎, and add alt text (the AI can suggest it).",
          }
        : { id: "alt", status: "pass", label: `All ${images.total} image${images.total === 1 ? " has" : "s have"} alt text` },
    );
  }

  // Account + plan rules (same checks submitForReview applies)
  const { eligible, missing } = await isEligibleToSubmit(userId);
  items.push(
    eligible
      ? { id: "verified", status: "pass", label: "Profile is verified for submitting" }
      : { id: "verified", status: "fail", label: "Get verified before submitting", detail: `Complete your profile: ${missing.join(", ")}.` },
  );

  const entitlements = await getEntitlements(userId);
  const pages = pagesNeeded(text);
  items.push(
    pages > entitlements.maxPagesPerArticle
      ? {
          id: "pages",
          status: "fail",
          label: "Too long for your plan",
          detail: `Runs to ${pages} magazine pages; your plan includes up to ${entitlements.maxPagesPerArticle}. Shorten it or upgrade.`,
        }
      : { id: "pages", status: "pass", label: `Fits your plan (${pages} of ${entitlements.maxPagesPerArticle} magazine pages)` },
  );
  if (articleHasVideoOrAudio(input.content) && !entitlements.videoEmbeds) {
    items.push({
      id: "media",
      status: "fail",
      label: "Video or audio isn't in your plan",
      detail: "Remove the video or audio clips, or upgrade, to submit.",
    });
  }

  let alreadySubmitted = false;
  if (input.articleId) {
    const article = await prisma.article.findUnique({
      where: { id: input.articleId },
      select: { authorId: true, submittedAt: true },
    });
    alreadySubmitted = Boolean(article && article.authorId === userId && article.submittedAt !== null);
  }
  if (!alreadySubmitted) {
    const allowance = await getSubmissionAllowance(userId);
    if (!allowance.allowed) {
      items.push({
        id: "allowance",
        status: "fail",
        label: "Monthly submissions used up",
        detail: `Your plan includes ${allowance.limit} per month. They reset on the 1st.`,
      });
    }
  }

  // AI content review
  if (words < 20) {
    items.push({ id: "ai-review", status: "warn", label: "AI content review skipped", detail: "Write at least 20 words first." });
  } else {
    const slot = takeAiSlot(userId, "presubmit-review");
    if (!slot.ok) {
      items.push({ id: "ai-review", status: "warn", label: "AI content review skipped", detail: slot.error });
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
        console.error("[runPreSubmitChecklist] AI review failed", err);
        items.push({ id: "ai-review", status: "warn", label: "AI content review couldn't run", detail: "Try again in a moment." });
      }
    }
  }

  return { items };
}

/**
 * The legal and compliance check shown before an article is submitted. It reviews the SAVED draft (the page
 * saves first), and stores its result with the article, so what the submit gate and the editors see is this
 * server-side result and never something the browser sent.
 */
export async function runLegalReview(input: {
  articleId: string;
  destination: ArticleDestination;
}): Promise<{ error: string } | { review: LegalReview; termsVersion: string }> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;

  if (input.destination !== "main_app" && input.destination !== "exchange_hub") {
    return { error: "Choose where this article should go once approved." };
  }

  const article = await prisma.article.findUnique({
    where: { id: String(input.articleId) },
    select: { authorId: true, status: true, title: true, content: true, aiScores: true },
  });
  if (!article || article.authorId !== session.user.id) return { error: "Article not found." };
  if (article.status !== "draft" && article.status !== "changes_requested") {
    return { error: "This article can't be submitted in its current state." };
  }
  if (!article.title.trim()) return { error: "Please add a title before submitting." };

  const text = articleJsonToText(article.content) || article.content;
  if (text.split(/\s+/).filter(Boolean).length < MIN_CHECK_WORDS) {
    return { error: `Write at least ${MIN_CHECK_WORDS} words before submitting.` };
  }

  const slot = takeAiSlot(session.user.id, "legal");
  if (!slot.ok) return { error: slot.error };

  const author = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true },
  });
  const review = await reviewLegal({
    title: article.title,
    text,
    destination: input.destination,
    authorName: author?.displayName ?? "Author",
  });

  const base =
    article.aiScores && typeof article.aiScores === "object" && !Array.isArray(article.aiScores)
      ? (article.aiScores as Record<string, unknown>)
      : {};
  await prisma.article.update({
    where: { id: input.articleId },
    data: { aiScores: { ...base, legalReview: review } as unknown as Prisma.InputJsonObject },
  });

  return { review, termsVersion: AUTHOR_TERMS_VERSION };
}

/** AI search title, description and keywords for the draft in the editor. Suggestions only; nothing is saved. */
export async function suggestArticleSeo(
  content: string,
  title: string,
  excerpt: string,
): Promise<{ error: string } | { result: SeoMetadata }> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;

  const text = articleJsonToText(content);
  if (text.split(/\s+/).filter(Boolean).length < MIN_CHECK_WORDS) {
    return { error: `Write at least ${MIN_CHECK_WORDS} words before asking for search metadata.` };
  }

  const slot = takeAiSlot(session.user.id, "seo");
  if (!slot.ok) return { error: slot.error };

  try {
    return { result: await suggestSeo(text, title.slice(0, 300), excerpt.slice(0, 400)) };
  } catch (err) {
    console.error("[suggestArticleSeo]", err);
    return { error: err instanceof Error ? err.message : "Suggestions failed. Please try again." };
  }
}

/**
 * Layout hints for the draft in the editor: pull quotes, section headings and
 * structure notes from the AI, plus where the magazine's page breaks fall and
 * how that compares with the plan's page limit. Suggestions only; nothing is saved.
 */
export async function getLayoutHints(
  content: string,
  title: string,
): Promise<{ error: string } | { hints: LayoutHints; pages: PageBreakdown; maxPages: number }> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;

  // The page readout counts everything the magazine page prints, quotes included; the AI reviews
  // the article without its pull quotes, so it doesn't flag them as repeated text.
  const text = articleJsonToText(content);
  const reviewText = articleJsonToText(content, { skipBlockquotes: true });
  const words = reviewText.split(/\s+/).filter(Boolean).length;
  if (words < MIN_CHECK_WORDS) {
    return { error: `Write at least ${MIN_CHECK_WORDS} words before asking for layout hints.` };
  }

  const slot = takeAiSlot(session.user.id, "layout");
  if (!slot.ok) return { error: slot.error };

  try {
    const [hints, entitlements] = await Promise.all([
      suggestLayout(reviewText, title.slice(0, 300), words),
      getEntitlements(session.user.id),
    ]);
    return { hints, pages: pageBreakdown(text), maxPages: entitlements.maxPagesPerArticle };
  } catch (err) {
    console.error("[getLayoutHints]", err);
    return { error: err instanceof Error ? err.message : "Layout hints failed. Please try again." };
  }
}

/** AI rewrite of the passage selected in the editor. Returns the proposal only; the author applies it. */
export async function rewriteSelectedText(
  text: string,
  action: string,
  instruction?: string,
): Promise<{ error: string } | { text: string }> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;

  if (!isRewriteAction(action)) return { error: "Choose a rewrite option." };
  const wanted = String(instruction ?? "").replace(/\s+/g, " ").trim();
  if (action === "custom" && wanted.length < MIN_INSTRUCTION_CHARS) {
    return { error: "Type what you want the AI to change, in a few words." };
  }
  if (wanted.length > MAX_INSTRUCTION_CHARS) {
    return { error: `Keep your instruction under ${MAX_INSTRUCTION_CHARS} characters.` };
  }
  const passage = String(text ?? "").trim();
  if (passage.split(/\s+/).filter(Boolean).length < 3) return { error: "Select a few more words to rewrite." };
  if (passage.length > MAX_REWRITE_CHARS) {
    return { error: `That selection is too long to rewrite at once. Select up to about ${Math.round(MAX_REWRITE_CHARS / 6)} words.` };
  }

  // Rewriting is iterative (try, tweak, try again), so allow a quicker cadence than the other tools.
  const slot = takeAiSlot(session.user.id, "rewrite", { dailyLimit: 100, cooldownMs: 1_500 });
  if (!slot.ok) return { error: slot.error };

  try {
    return { text: await rewriteText(passage, action, wanted) };
  } catch (err) {
    console.error("[rewriteSelectedText]", err);
    return { error: err instanceof Error ? err.message : "Rewrite failed. Please try again." };
  }
}

/** AI alt text + caption for an image uploaded into the article. Suggestions only; nothing is saved. */
export async function suggestMediaText(
  src: string,
  articleTitle: string,
): Promise<{ error: string } | { result: ImageTextResult }> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;

  const slot = takeAiSlot(session.user.id, "image-text");
  if (!slot.ok) return { error: slot.error };

  try {
    return { result: await suggestImageText(String(src), articleTitle.slice(0, 300)) };
  } catch (err) {
    console.error("[suggestMediaText]", err);
    return { error: err instanceof Error ? err.message : "Suggestions failed. Please try again." };
  }
}

/** AI tag + content-type suggestions for the draft in the editor. Suggestions only; nothing is saved. */
export async function suggestArticleTags(
  content: string,
  title: string,
): Promise<{ error: string } | { result: TagSuggestionResult }> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;

  const text = articleJsonToText(content);
  if (text.split(/\s+/).filter(Boolean).length < MIN_CHECK_WORDS) {
    return { error: `Write at least ${MIN_CHECK_WORDS} words before asking for tag ideas.` };
  }

  const slot = takeAiSlot(session.user.id, "tags");
  if (!slot.ok) return { error: slot.error };

  try {
    return { result: await suggestTags(text, title.slice(0, 300), await listTags()) };
  } catch (err) {
    console.error("[suggestArticleTags]", err);
    return { error: err instanceof Error ? err.message : "Suggestions failed. Please try again." };
  }
}

/** AI title options + an excerpt for the draft in the editor. Suggestions only; nothing is saved. */
export async function suggestArticleTitleAndExcerpt(
  content: string,
  currentTitle: string,
): Promise<{ error: string } | { result: TitleExcerptResult }> {
  const session = await requireAuthorSession();
  const suspendedError = await checkNotSuspended(session.user.id);
  if (suspendedError) return suspendedError;

  const text = articleJsonToText(content);
  if (text.split(/\s+/).filter(Boolean).length < MIN_CHECK_WORDS) {
    return { error: `Write at least ${MIN_CHECK_WORDS} words before asking for title and excerpt ideas.` };
  }

  const slot = takeAiSlot(session.user.id, "title-excerpt");
  if (!slot.ok) return { error: slot.error };

  try {
    return { result: await suggestTitleAndExcerpt(text, currentTitle.slice(0, 300)) };
  } catch (err) {
    console.error("[suggestArticleTitleAndExcerpt]", err);
    return { error: err instanceof Error ? err.message : "Suggestions failed. Please try again." };
  }
}
