"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { formControl } from "@/components/ui/Form";
import { cn } from "@/lib/cn";
import type { SocialPosts } from "@/lib/socialPosts";
import { isRightToLeft, TRANSLATION_LANGUAGES } from "@/lib/translationLanguages";
import type { Translation } from "@/lib/translate";

import { createSocialPosts, translateOwnArticle } from "./promoteActions";

/** X counts any link as 23 characters, plus the space before it. */
const X_LINK_COST = 24;
const X_LIMIT = 280;

const PLATFORMS: { key: keyof SocialPosts; label: string; linkable: boolean }[] = [
  { key: "linkedin", label: "LinkedIn", linkable: true },
  { key: "facebook", label: "Facebook", linkable: true },
  { key: "instagram", label: "Instagram", linkable: false },
  { key: "x", label: "X (Twitter)", linkable: true },
];

/** Social posts and translation for an article's own author. Text to copy; nothing is posted or saved. */
export function PromoteTools({ articleId }: { articleId: string }) {
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [posts, setPosts] = useState<SocialPosts | null>(null);
  const [withLink, setWithLink] = useState(true);

  const [language, setLanguage] = useState<string>(TRANSLATION_LANGUAGES[0].code);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [translation, setTranslation] = useState<{ data: Translation; code: string; label: string } | null>(null);

  const [copied, setCopied] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  function articleLink() {
    return `${window.location.origin}/article?id=${articleId}`;
  }

  function copy(id: string, text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(id);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 1800);
  }

  /** The text that gets copied for a platform, with the article link when asked for. */
  function postWithLink(key: keyof SocialPosts, linkable: boolean): string {
    const text = posts?.[key] ?? "";
    if (!withLink || !linkable) return text;
    return key === "x" ? `${text} ${articleLink()}` : `${text}\n\n${articleLink()}`;
  }

  async function writePosts() {
    setPosting(true);
    setPostError(null);
    try {
      const res = await createSocialPosts(articleId);
      if ("error" in res) setPostError(res.error);
      else setPosts(res.posts);
    } catch {
      setPostError("Couldn't write the posts. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function runTranslate() {
    setTranslating(true);
    setTranslateError(null);
    try {
      const res = await translateOwnArticle(articleId, language);
      if ("error" in res) setTranslateError(res.error);
      else setTranslation({ data: res.translation, code: language, label: res.language });
    } catch {
      setTranslateError("The translation failed. Please try again.");
    } finally {
      setTranslating(false);
    }
  }

  const copyButton = "cursor-pointer text-[11px] font-semibold text-primary hover:underline";

  return (
    <section className="mb-8 rounded-lg border border-line bg-bg-primary p-4" aria-label="Promote and translate">
      <h3 className="font-heading text-base leading-[1.25] font-bold text-text-main">Promote &amp; translate</h3>
      <p className="mt-1 text-[11.5px] text-text-muted">
        Only you can see this. The AI writes drafts for you to copy &mdash; nothing is posted or saved.
      </p>

      {/* Social posts */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-text-main">Social media posts</h4>
          <Button size="sm" variant="secondary" onClick={writePosts} disabled={posting}>
            {posting ? "Writing..." : posts ? "Write again" : "Write posts with AI"}
          </Button>
        </div>
        {postError && !posting && <p className="mt-2 text-[12px] text-danger">{postError}</p>}

        {posts && !posting && (
          <>
            <label className="mt-3 flex items-center gap-2 text-[11.5px] text-text-muted">
              <input
                type="checkbox"
                checked={withLink}
                onChange={(e) => setWithLink(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              Add a link to this article when copying (readers need to be signed in to MYHitch Lens to open it)
            </label>
            <ul className="mt-3 flex flex-col gap-3">
              {PLATFORMS.map(({ key, label, linkable }) => {
                const text = posts[key];
                if (!text) return null;
                const length = key === "x" ? text.length + (withLink ? X_LINK_COST : 0) : text.length;
                const tooLong = key === "x" && length > X_LIMIT;
                return (
                  <li key={key} className="rounded-lg border border-line bg-bg-secondary p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wide text-primary uppercase">{label}</span>
                      <span className={cn("text-[11px]", tooLong ? "font-semibold text-danger" : "text-text-muted")}>
                        {length}
                        {key === "x" ? `/${X_LIMIT}` : ""} characters
                      </span>
                    </div>
                    <p className="text-[12.5px] whitespace-pre-wrap text-text-main">{text}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <button type="button" onClick={() => copy(key, postWithLink(key, linkable))} className={copyButton}>
                        {copied === key ? "Copied ✓" : "Copy"}
                      </button>
                      {!linkable && (
                        <span className="text-[11px] text-text-muted">Instagram captions can&apos;t hold a clickable link &mdash; put it in your bio.</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Translation */}
      <div className="mt-6 border-t border-line pt-5">
        <h4 className="text-xs font-bold text-text-main">Translate this article</h4>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className={cn(formControl, "w-auto min-w-[190px]")}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={translating}
            aria-label="Language to translate into"
          >
            {TRANSLATION_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <Button size="sm" variant="secondary" onClick={runTranslate} disabled={translating}>
            {translating ? "Translating..." : "Translate"}
          </Button>
        </div>
        {translating && <p className="mt-2 text-[12px] text-text-muted">Translating the whole article can take up to 10 seconds.</p>}
        {translateError && !translating && <p className="mt-2 text-[12px] text-danger">{translateError}</p>}

        {translation && !translating && (
          <div className="mt-3 rounded-lg border border-line bg-bg-secondary p-3">
            <p className="text-[10px] font-bold tracking-wide text-primary uppercase">{translation.label}</p>
            <div dir={isRightToLeft(translation.code) ? "rtl" : "ltr"}>
              <p className="mt-1.5 text-[14px] font-bold text-text-main">{translation.data.title}</p>
              <div className="mt-2 max-h-80 overflow-auto text-[12.5px] leading-relaxed text-text-main">
                {translation.data.text.split("\n").map((paragraph, i) => (
                  <p key={i} className="mb-2.5">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <button type="button" onClick={() => copy("tr-title", translation.data.title)} className={copyButton}>
                {copied === "tr-title" ? "Copied ✓" : "Copy title"}
              </button>
              <button type="button" onClick={() => copy("tr-text", translation.data.text)} className={copyButton}>
                {copied === "tr-text" ? "Copied ✓" : "Copy article text"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-text-muted">
              This is an AI draft. Have a fluent speaker check it before you publish it anywhere.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
