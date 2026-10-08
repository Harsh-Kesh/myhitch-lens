import Link from "next/link";

import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * A feature the user's plan does not include: says what it is, which plan unlocks
 * it, and links to the packages. Used wherever a screen would otherwise show a
 * tool the plan can't use.
 */
export function LockedFeature({
  title,
  plan,
  description,
  className,
}: {
  title: string;
  /** Lowest plan that includes it, e.g. "Lens Professional". */
  plan: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed border-line bg-bg-secondary p-6 text-center", className)}>
      <p className="font-heading text-[15px] font-bold text-text-main">{title}</p>
      <p className="mt-1 text-[12.5px] text-text-muted">
        {description ? `${description} ` : ""}Available on {plan} and above.
      </p>
      <Link href="/author-dashboard#packages" className={buttonClasses("primary", "sm", "mt-4")}>
        See packages
      </Link>
    </div>
  );
}
