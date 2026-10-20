/**
 * Shapes shared between the legal review (server), the submit popup and the
 * editorial board. Plain data, no server imports.
 */

export type LegalStatus = "clear" | "review" | "risk";

export const LEGAL_CHECKS = [
  { id: "defamation", label: "Defamation risk", blurb: "Harmful or unverified allegations" },
  { id: "privacy", label: "Privacy and confidential information", blurb: "Personal or sensitive information" },
  { id: "identity", label: "Identity and impersonation", blurb: "Author verification and impersonation" },
  { id: "commercial", label: "Commercial disclosure", blurb: "Sponsored content and advertising" },
  { id: "jurisdiction", label: "Country-specific legal risks", blurb: "Jurisdiction-specific requirements" },
  { id: "standards", label: "Content standards", blurb: "Abuse, spam and off-topic text" },
] as const;

export type LegalCheckId = (typeof LEGAL_CHECKS)[number]["id"];

export type LegalFinding = {
  /** Exact words from the article, or "" for a point about the article as a whole. */
  quote: string;
  reason: string;
  /** What the author could do about it. */
  fix: string;
};

export type LegalCheck = {
  id: LegalCheckId;
  label: string;
  status: LegalStatus;
  summary: string;
  findings: LegalFinding[];
};

export type LegalReview = {
  /** False when the AI couldn't run: the author can still submit after accepting the terms. */
  available: boolean;
  reviewedAt: string;
  /** Fingerprint of the title, destination and text that were reviewed. */
  contentHash: string;
  checks: LegalCheck[];
  /** Countries or regions the article touches or is aimed at. */
  jurisdictions: string[];
};

/** What the author agreed to when they submitted. */
export type LegalAcceptance = {
  termsVersion: string;
  acceptedAt: string;
};

/** What an editor sees for a submitted article: the saved review plus the author's acceptance. */
export type ReviewLegalSummary = {
  review: LegalReview;
  acceptance: LegalAcceptance | null;
};

export const LEGAL_STATUS_RANK: Record<LegalStatus, number> = { clear: 0, review: 1, risk: 2 };

export function worstStatus(checks: { status: LegalStatus }[]): LegalStatus {
  return checks.reduce<LegalStatus>((worst, c) => (LEGAL_STATUS_RANK[c.status] > LEGAL_STATUS_RANK[worst] ? c.status : worst), "clear");
}
