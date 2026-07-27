import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** `.container` - 1200px centred column with 24px gutters (20px on phones). */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-[1200px] px-6 max-[480px]:px-5", className)}>
      {children}
    </div>
  );
}

/** `.badge-pill` - the small outlined capsule above section titles. */
export function BadgePill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-[50px] border border-primary bg-primary-glow px-4 py-1.5 text-[13px] font-semibold text-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The uppercase, letter-spaced variant used inside page heroes. */
export function HeroBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-[50px] border border-primary bg-primary-glow px-4 py-1.5 text-xs font-bold tracking-[1px] text-primary uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** `.section-title` */
export function SectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mb-4 font-heading text-[36px] leading-[1.25] font-bold tracking-[-1px] text-text-main max-[768px]:text-[29px] max-[480px]:text-[25px] max-[480px]:tracking-[-0.5px]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** `.section-subtitle` */
export function SectionSubtitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("text-base text-text-muted", className)}>{children}</p>;
}

/**
 * `.page-hero-section` - the reusable radial-gradient hero shared by every
 * secondary landing page.
 */
export function PageHero({
  badge,
  title,
  subtitle,
  backgroundImage,
  className,
}: {
  badge: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  backgroundImage?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-line px-5 pt-25 pb-15 text-center max-[768px]:pt-16 max-[768px]:pb-10",
        !backgroundImage &&
          "bg-[radial-gradient(circle_at_top,var(--primary-glow)_0%,transparent_60%)]",
        className,
      )}
      style={
        backgroundImage
          ? {
              background: `url('${backgroundImage}') no-repeat center center / cover`,
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-[800px]">
        <HeroBadge className="mb-5">{badge}</HeroBadge>
        <h1 className="mb-5 font-heading text-[44px] leading-[1.2] font-extrabold tracking-[-1px] text-text-main max-[768px]:text-[34px] max-[480px]:text-[27px] max-[480px]:tracking-[-0.5px]">
          {title}
        </h1>
        <p className="mx-auto max-w-[650px] text-base leading-[1.8] text-text-muted max-[480px]:text-[15px]">
          {subtitle}
        </p>
      </div>
    </section>
  );
}

/** `.hero-accent` - the primary-coloured span inside hero headlines. */
export function HeroAccent({ children }: { children: ReactNode }) {
  return <span className="text-primary">{children}</span>;
}
