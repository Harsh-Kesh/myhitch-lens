import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "iconOnly";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * `.btn` - shared shell for every button in the original design system.
 * `leading-normal` keeps anchors rendered as buttons the same height as real
 * <button> elements, which take that leading from the user agent.
 */
const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 border border-transparent font-body font-semibold leading-[normal] transition-all duration-200";

/** `.btn-sm` / `.btn` / `.btn-lg` */
const sizes: Record<ButtonSize, string> = {
  sm: "rounded-md px-3 py-1.5 text-xs",
  md: "rounded-lg px-5 py-2.5 text-sm",
  lg: "rounded-[10px] px-7 py-3.5 text-base",
};

const variants: Record<ButtonVariant, string> = {
  // `.btn-primary`
  primary:
    "bg-primary text-text-inverse shadow-[0_4px_14px_var(--primary-glow)] hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_6px_20px_var(--primary-glow)]",
  // `.btn-secondary`
  secondary:
    "border-line bg-bg-tertiary text-text-main hover:-translate-y-0.5 hover:border-line-hover hover:bg-surface-hover",
  // `.btn-icon-only`
  iconOnly:
    "size-10 rounded-lg border-line bg-transparent text-text-main hover:border-line-hover hover:bg-bg-tertiary",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(base, variant !== "iconOnly" && sizes[size], variants[variant], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
}

/** Button-styled navigation. The original used `onclick=location.href=...`. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
