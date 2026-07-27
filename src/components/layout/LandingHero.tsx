import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { HeroBadge } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

interface LandingHeroProps {
  /** Path under /public, e.g. `/images/home_hero.png`. */
  image: string;
  /** Which edge of the artwork stays in frame. */
  imagePosition?: "left" | "right";
  badge: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
}

/**
 * `.hero-section` + `.hero-container` + `.hero-content` - the full-bleed
 * headline block that opens every public page. The original `.hero-visual`
 * placeholder is omitted because the stylesheet hid it with
 * `display: none !important`.
 */
export function LandingHero({
  image,
  imagePosition = "right",
  badge,
  title,
  subtitle,
}: LandingHeroProps) {
  return (
    <section
      className={cn(
        // `100svh` measures against the *small* viewport, so the hero never
        // hides its own actions behind mobile browser chrome.
        "hero-section relative flex min-h-[calc(100svh-var(--header-h))] items-center overflow-hidden border-b border-line bg-cover pt-25 pb-20 max-[1024px]:bg-[left_center] max-[768px]:min-h-0 max-[768px]:pt-15 max-[768px]:pb-12",
        imagePosition === "right" ? "bg-[right_center]" : "bg-[left_center]",
      )}
      style={{ backgroundImage: `url('${image}')`, backgroundRepeat: "no-repeat" }}
    >
      <div className="flex w-full max-w-full flex-col items-start justify-center pr-10 pl-15 max-[1024px]:px-8 max-[768px]:items-center max-[768px]:px-6 max-[768px]:py-15 max-[768px]:text-center max-[480px]:px-5">
        <div className="max-w-[750px] text-left max-[768px]:text-center">
          <HeroBadge className="hero-badge mb-5">{badge}</HeroBadge>
          <h1 className="hero-title mb-5 font-heading text-[44px] leading-[1.2] font-extrabold tracking-[-1px] text-text-main max-[1024px]:text-[38px] max-[768px]:text-[34px] max-[480px]:text-[27px] max-[480px]:tracking-[-0.5px]">
            {title}
          </h1>
          <p className="hero-subtitle mb-[30px] text-base leading-[1.8] text-text-muted max-[480px]:text-[15px]">
            {subtitle}
          </p>
          <div className="hero-actions flex flex-wrap gap-3 max-[768px]:justify-center">
            <ButtonLink href="/auth?mode=signup">Get Started Today</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Contact Support
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The GSAP step every landing hero shares. */
export const HERO_REVEAL = {
  targets:
    ".hero-section .hero-badge, .hero-section .hero-title, .hero-section .hero-subtitle, .hero-section .hero-actions",
  y: 30,
  duration: 0.8,
  stagger: 0.15,
};
