import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** `.form-control` - inputs, selects and textareas share one skin. */
export const formControl =
  "w-full rounded-lg border border-line bg-bg-primary px-4 py-2.5 font-body text-sm leading-[normal] text-text-main outline-none transition-all duration-200 placeholder:text-text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20";

/** `.form-control-sm` */
export const formControlSm =
  "w-full rounded-md border border-line bg-bg-primary px-3 py-1.5 text-xs leading-[normal] text-text-main outline-none transition-all duration-200 placeholder:text-text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20";

/** `.select-input` - the compact select used in the sidebar role simulator. */
export const selectInput =
  "w-full cursor-pointer rounded-md border border-line bg-bg-primary px-3 py-2 font-body text-[13px] leading-[normal] text-text-main outline-none focus:border-primary";

/** `.form-group label` */
export const formLabel =
  "mb-2 block text-xs font-semibold text-text-muted uppercase";

/** `.form-group` */
export function FormGroup({
  label,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      {label && (
        <label htmlFor={htmlFor} className={formLabel}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

/** `.editor-workspace` - the bordered panel that wraps forms and long copy. */
export const workspacePanel =
  "rounded-xl border border-line bg-bg-secondary p-8 max-[640px]:p-5";
