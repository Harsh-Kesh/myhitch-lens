"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { AUTHOR_TERMS_SECTIONS, AUTHOR_TERMS_VERSION } from "@/lib/authorTerms";
import { cn } from "@/lib/cn";
import { blockingIssues, type LegalReview, type LegalStatus } from "@/lib/legalReviewTypes";
import type { ArticleDestination } from "@prisma/client";

import { runLegalReview } from "./actions";

const STATUS_LABEL: Record<LegalStatus, string> = { clear: "Clear", review: "Check this", risk: "Risk" };
const STATUS_ICON: Record<LegalStatus, string> = { clear: "✓", review: "!", risk: "✕" };
const STATUS_STYLE: Record<LegalStatus, string> = {
  clear: "bg-success/10 text-success",
  review: "bg-warning/10 text-warning",
  risk: "bg-danger/10 text-danger",
};

/**
 * Shown when the author clicks Submit: runs the AI legal and compliance check, shows the Author
 * Content Terms, and only lets the article go on once the terms are accepted (and any flagged risks
 * are acknowledged). The server checks all of this again at submission.
 */
export function LegalReviewModal({
  articleId,
  destination,
  submitting,
  onCancel,
  onConfirm,
}: {
  articleId: string;
  destination: ArticleDestination;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (legal: { termsAccepted: true; termsVersion: string }) => void;
}) {
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<LegalReview | null>(null);
  const [termsVersion, setTermsVersion] = useState(AUTHOR_TERMS_VERSION);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setReview(null);
    try {
      const res = await runLegalReview({ articleId, destination });
      if ("error" in res) setError(res.error);
      else {
        setReview(res.review);
        setTermsVersion(res.termsVersion);
      }
    } catch {
      setError("The legal check failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }, [articleId, destination]);

  useEffect(() => {
    // Kick off the check as soon as the popup opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
  }, [run]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, submitting]);

  // Any issue in the report blocks the submission until the author fixes the article and the check comes back clear.
  const issues = review && review.available ? blockingIssues(review.checks) : [];
  const blocked = issues.length > 0;
  const canSubmit = !!review && !running && !submitting && !blocked && agreeTerms;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/50" onClick={() => !submitting && onCancel()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Legal and compliance review"
        className="fixed top-1/2 left-1/2 z-[70] flex max-h-[90vh] w-[min(640px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-bg-secondary shadow-card"
      >
        <div className="overflow-y-auto p-6 max-[480px]:p-4">
          <h3 className="font-heading text-lg font-bold text-text-main">Before you submit</h3>
          <p className="mt-1 text-[12px] text-text-muted">
            A quick legal and compliance check on your article, then our author terms. This is automated screening, not legal advice.
          </p>

          {/* The check */}
          <section className="mt-5" aria-label="Legal and compliance check">
            {running && (
              <div className="rounded-lg border border-line bg-bg-primary p-4 text-sm text-text-muted">
                Checking your article for defamation, privacy, impersonation, commercial, country-specific and content-standards issues&hellip; this takes about 10 seconds.
              </div>
            )}

            {error && !running && (
              <div className="rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
                {error}
                <button type="button" onClick={run} className="mt-2 block cursor-pointer text-[12px] font-semibold text-primary hover:underline">
                  Try again
                </button>
              </div>
            )}

            {review && !running && (
              <>
                {!review.available && (
                  <p className="mb-3 rounded-lg border border-warning/40 bg-warning/5 p-3 text-[12px] text-warning">
                    The automated check couldn&apos;t run just now, so your article wasn&apos;t screened. You can still submit, and an editor will review it.
                  </p>
                )}
                {blocked && (
                  <div role="alert" className="mb-3 rounded-lg border border-danger/40 bg-danger/5 p-3.5">
                    <p className="text-[13px] font-bold text-danger">
                      {issues.length} {issues.length === 1 ? "issue" : "issues"} to fix before you can submit
                    </p>
                    <p className="mt-1 text-[12px] text-text-main">
                      Edit your article to fix the points marked below, then click Submit again. The check runs again each time.
                    </p>
                  </div>
                )}
                {!blocked && review.available && (
                  <p className="mb-3 rounded-lg border border-success/40 bg-success/5 p-3 text-[12.5px] font-semibold text-success">
                    No legal or compliance issues found. Read and accept the terms below to submit.
                  </p>
                )}
                <ul className="flex flex-col gap-2.5">
                  {review.checks.map((check) => (
                    <li key={check.id} className="rounded-lg border border-line bg-bg-primary p-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className={cn("mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", STATUS_STYLE[check.status])}
                        >
                          {STATUS_ICON[check.status]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-text-main">
                            {check.label}
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase", STATUS_STYLE[check.status])}>
                              {STATUS_LABEL[check.status]}
                            </span>
                          </p>
                          {check.summary && <p className="mt-0.5 text-[12px] text-text-muted">{check.summary}</p>}
                          {check.findings.length > 0 && (
                            <ul className="mt-2 flex flex-col gap-2">
                              {check.findings.map((f, i) => (
                                <li key={i} className="rounded-md border border-line bg-bg-secondary p-2.5 text-[12px]">
                                  {f.quote && <p className="border-l-2 border-primary pl-2 text-text-main italic">&ldquo;{f.quote}&rdquo;</p>}
                                  <p className={cn("text-text-main", f.quote && "mt-1.5")}>{f.reason}</p>
                                  {f.fix && (
                                    <p className="mt-1 text-text-muted">
                                      <span className="font-semibold text-text-main">What you can do: </span>
                                      {f.fix}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {review.available && review.jurisdictions.length > 0 && (
                  <p className="mt-2 text-[11.5px] text-text-muted">
                    Countries or regions this article touches: <strong className="text-text-main">{review.jurisdictions.join(", ")}</strong>
                  </p>
                )}
                <button
                  type="button"
                  onClick={run}
                  disabled={submitting}
                  className="mt-2 cursor-pointer text-[11.5px] font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  Check again
                </button>
                <p className="mt-1 text-[11px] text-text-muted">
                  To change your article, go back to editing, then submit again. The check runs on the version you saved.
                </p>
              </>
            )}
          </section>

          {/* Terms: only once the report is clear, so an author with issues to fix isn't asked to agree to anything yet */}
          {!blocked && (
          <section className="mt-5" aria-label="Author Content Terms">
            <div className="flex items-baseline justify-between">
              <h4 className="text-[13px] font-bold text-text-main">Author Content Terms</h4>
              <span className="text-[10.5px] text-text-muted">Version {termsVersion}</span>
            </div>
            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-line bg-bg-primary p-3.5">
              {AUTHOR_TERMS_SECTIONS.map((s) => (
                <div key={s.title} className="mb-3 last:mb-0">
                  <p className="text-[12px] font-semibold text-text-main">{s.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-muted">{s.body}</p>
                </div>
              ))}
            </div>

            <label className="mt-3 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="text-[12.5px] text-text-main">I have read and agree to the Author Content Terms.</span>
            </label>
          </section>
          )}
        </div>

        <div className="flex gap-3 border-t border-line p-4 max-[480px]:flex-col">
          <Button variant={blocked ? "primary" : "secondary"} className="flex-1" onClick={onCancel} disabled={submitting}>
            Back to editing
          </Button>
          <Button
            variant={blocked ? "secondary" : "primary"}
            className="flex-1"
            disabled={!canSubmit}
            onClick={() => onConfirm({ termsAccepted: true, termsVersion })}
          >
            {submitting ? "Submitting..." : blocked ? "Can't submit yet" : "Agree & submit"}
          </Button>
        </div>
      </div>
    </>
  );
}
