import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Shared card + heading skins so every dashboard reads as one system. */
export const dashCard =
  "rounded-xl border border-line bg-bg-secondary p-6 max-[480px]:p-5";

export const dashHeading =
  "mb-4 flex items-center gap-2 font-heading text-[15px] font-bold text-text-main";

/** Compact metric tile used in the stat row atop each dashboard. */
export function StatChip({
  icon,
  value,
  label,
  accent = false,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-secondary px-4 py-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          accent ? "bg-[rgba(5,150,105,0.12)] text-success" : "bg-primary-glow text-primary",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <span className="block truncate font-heading text-lg font-bold text-text-main">
          {value}
        </span>
        <span className="text-[11px] font-medium text-text-muted uppercase">{label}</span>
      </div>
    </div>
  );
}

/** Friendly placeholder for empty lists. */
export function EmptyState({ text, cta }: { text: string; cta?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-bg-primary px-4 py-8 text-center">
      <p className="text-[13px] text-text-muted">{text}</p>
      {cta}
    </div>
  );
}
