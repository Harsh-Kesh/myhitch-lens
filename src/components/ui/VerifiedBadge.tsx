import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * The "blue mark" — a person-level identity-verification badge, shown wherever a
 * verified author appears. Distinct from the article-level "Editor-reviewed" pill.
 */
export function VerifiedBadge({
  size = "sm",
  label = false,
  className,
}: {
  size?: "xs" | "sm" | "md";
  /** Show the word "Verified" next to the mark. */
  label?: boolean;
  className?: string;
}) {
  const dot = size === "xs" ? "size-3.5" : size === "md" ? "size-5" : "size-4";
  const tick = size === "xs" ? "size-2" : size === "md" ? "size-3" : "size-2.5";
  return (
    <span
      title="Verified — identity confirmed by the editorial team"
      aria-label="Verified"
      className={cn("inline-flex items-center gap-1 align-middle", className)}
    >
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-white", dot)}>
        <CheckIcon className={tick} strokeWidth={3} />
      </span>
      {label && <span className="text-[11px] font-semibold text-primary">Verified</span>}
    </span>
  );
}
