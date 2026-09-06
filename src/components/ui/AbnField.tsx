"use client";

import { useEffect, useRef, useState } from "react";

import { formControl, formLabel } from "@/components/ui/Form";
import { normalizeAbn } from "@/lib/abn";
import { resolveAbn } from "@/lib/abnSearchAction";
import { cn } from "@/lib/cn";

const DEBOUNCE_MS = 350;

/**
 * ABN input: type the 11 digits and its registered name resolves live
 * (checksum + a real ABR lookup), shown right under the field. Pair it with
 * a separate company-name field via `compareName` — if the two don't
 * loosely match, a soft, non-blocking note appears rather than a hard
 * block, since a trading name legitimately differs from the ABR's
 * registered entity name.
 *
 * Deliberately doesn't push every keystroke up as the committed `abn`
 * value — only a fully resolved, valid ABN is reported via `onChange`. The
 * server still re-validates on submit regardless, exactly as it already
 * did before this component existed.
 */
export function AbnField({
  value,
  onChange,
  label = "ABN",
  required = false,
  compareName,
}: {
  value: string;
  onChange: (abn: string) => void;
  label?: string;
  required?: boolean;
  /** A separate company-name field to cross-check the resolved name against. */
  compareName?: string;
}) {
  const [query, setQuery] = useState(value);
  const [matched, setMatched] = useState<{ name: string; abn: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleInput(text: string) {
    setQuery(text);
    setMatched(null);
    setError(null);
    setStatus("idle");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const myRequest = ++requestId.current;
      const digits = normalizeAbn(text);
      if (digits.length !== 11) return; // nothing to resolve yet, not an error either

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
    }, DEBOUNCE_MS);
  }

  const nameMismatch =
    matched && compareName && compareName.trim().length >= 3 && !looselyMatches(matched.name, compareName);

  return (
    <div>
      <label htmlFor="abnFieldInput" className={formLabel}>
        {label}
        {required && " *"}
      </label>
      <input
        id="abnFieldInput"
        type="text"
        autoComplete="off"
        inputMode="numeric"
        className={cn(formControl, status === "invalid" && "border-danger")}
        placeholder="11 digit ABN"
        value={query}
        onChange={(event) => handleInput(event.target.value)}
      />

      {status === "checking" && <p className="mt-1.5 text-[11.5px] text-text-muted">Checking…</p>}

      {matched && (
        <p className="mt-1.5 text-[11.5px] text-success">Registered to: {matched.name}</p>
      )}

      {nameMismatch && (
        <p className="mt-1.5 text-[11.5px] text-warning">
          Heads up — this ABN is registered as &ldquo;{matched.name}&rdquo;, not &ldquo;{compareName}&rdquo;.
          That&rsquo;s fine if this is a trading name, just worth double-checking the ABN is the right one.
        </p>
      )}

      {error && <p className="mt-1.5 text-[11.5px] text-danger">{error}</p>}
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
