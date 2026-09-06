"use client";

import { useEffect, useRef, useState } from "react";

import { formControl, formLabel } from "@/components/ui/Form";
import { normalizeAbn, type AbnNameMatch } from "@/lib/abn";
import { resolveAbn, searchAbnCandidates } from "@/lib/abnSearchAction";
import { cn } from "@/lib/cn";

const DEBOUNCE_MS = 350;

/**
 * One field, either direction: type an ABN and its registered name resolves
 * automatically, or type a business name and pick from real ABR matches to
 * fill in the ABN. Either way the resolved ABN and entity name are always
 * shown together, so they can never silently drift out of sync.
 *
 * Deliberately doesn't push every keystroke up as the committed `abn` value —
 * only a fully resolved ABN (typed directly, or chosen from the name-search
 * dropdown) is reported via `onChange`. The server still re-validates on
 * submit regardless, exactly as it already did before this component existed.
 */
export function AbnField({
  value,
  onChange,
  label = "ABN",
  required = false,
  /** When set, a resolved ABN whose registered name doesn't loosely match
   *  this gets a soft, non-blocking note — e.g. the typed company name. */
  compareName,
}: {
  value: string;
  onChange: (abn: string) => void;
  label?: string;
  required?: boolean;
  compareName?: string;
}) {
  const [query, setQuery] = useState(value);
  const [candidates, setCandidates] = useState<AbnNameMatch[]>([]);
  // `query` is whatever's in the text box — a name after picking a
  // candidate, not necessarily the ABN digits — so the resolved ABN has to
  // be tracked separately rather than derived from it.
  const [matched, setMatched] = useState<{ name: string; state?: string; abn: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function runQuery(text: string) {
    const myRequest = ++requestId.current;
    const digits = normalizeAbn(text);
    const isAbnShaped = digits.length > 0 && digits.length === text.replace(/\s/g, "").length;

    if (isAbnShaped && digits.length === 11) {
      setStatus("checking");
      resolveAbn(digits).then((result) => {
        if (requestId.current !== myRequest) return; // a newer keystroke already superseded this
        if (result.valid) {
          setStatus("idle");
          setError(null);
          setMatched(result.entityName ? { name: result.entityName, abn: digits } : null);
          onChange(digits);
        } else {
          setStatus("invalid");
          setError(result.error ?? "That ABN doesn't look valid.");
          setMatched(null);
        }
      });
      return;
    }

    if (isAbnShaped) {
      // Still typing the digits — nothing to look up yet, not an error either.
      setStatus("idle");
      setError(null);
      setMatched(null);
      setCandidates([]);
      return;
    }

    if (text.trim().length >= 3) {
      searchAbnCandidates(text.trim()).then((results) => {
        if (requestId.current !== myRequest) return;
        setCandidates(results);
      });
    } else {
      setCandidates([]);
    }
  }

  function handleInput(text: string) {
    setQuery(text);
    setMatched(null);
    setError(null);
    setCandidates([]);
    setStatus("idle");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runQuery(text), DEBOUNCE_MS);
  }

  function pickCandidate(candidate: AbnNameMatch) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestId.current += 1; // invalidate any in-flight search
    setQuery(candidate.name);
    setCandidates([]);
    setMatched({ name: candidate.name, state: candidate.state, abn: candidate.abn });
    setStatus("idle");
    setError(null);
    onChange(candidate.abn);
  }

  const nameMismatch =
    matched && compareName && compareName.trim().length >= 3 && !looselyMatches(matched.name, compareName);

  return (
    <div className="relative">
      <label htmlFor="abnFieldInput" className={formLabel}>
        {label}
        {required && " *"}
      </label>
      <input
        id="abnFieldInput"
        type="text"
        autoComplete="off"
        className={cn(formControl, status === "invalid" && "border-danger")}
        placeholder="Search by ABN or business name"
        value={query}
        onChange={(event) => handleInput(event.target.value)}
      />

      {status === "checking" && <p className="mt-1.5 text-[11.5px] text-text-muted">Checking…</p>}

      {matched && (
        <p className="mt-1.5 text-[11.5px] text-success">
          Matched: {matched.name}
          {matched.state ? ` (${matched.state})` : ""} — ABN {matched.abn}
        </p>
      )}

      {nameMismatch && (
        <p className="mt-1.5 text-[11.5px] text-warning">
          Heads up — this ABN is registered as &ldquo;{matched.name}&rdquo;, not &ldquo;{compareName}&rdquo;.
          That&rsquo;s fine if this is a trading name, just worth double-checking the ABN is the right one.
        </p>
      )}

      {error && <p className="mt-1.5 text-[11.5px] text-danger">{error}</p>}

      {candidates.length > 0 && (
        <ul className="absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-bg-primary shadow-card">
          {candidates.map((candidate) => (
            <li key={`${candidate.abn}-${candidate.nameType}`}>
              <button
                type="button"
                onClick={() => pickCandidate(candidate)}
                className="flex w-full flex-col items-start gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="text-[12.5px] font-semibold text-text-main">{candidate.name}</span>
                <span className="text-[11px] text-text-muted">
                  ABN {candidate.abn}
                  {candidate.state ? ` · ${candidate.state}` : ""} · {candidate.nameType}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Word-overlap check, not exact equality — a trading name legitimately
 *  differs from the ABR's registered entity name, so this only flags a
 *  genuinely unrelated pair rather than every stylistic difference. */
function looselyMatches(entityName: string, typedName: string): boolean {
  const words = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["PTY", "LTD", "LIMITED", "THE", "AND"].includes(w));

  const entityWords = words(entityName);
  const typedWords = words(typedName);
  if (entityWords.length === 0 || typedWords.length === 0) return true; // nothing meaningful to compare

  return typedWords.some((w) => entityWords.includes(w)) || entityWords.some((w) => typedWords.includes(w));
}
