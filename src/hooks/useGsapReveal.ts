"use client";

import { useEffect, useRef, type RefObject } from "react";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export interface RevealStep {
  /** Selector(s) to animate, scoped to the container element. */
  targets: string;
  /** Selector that triggers the animation on scroll. Omit to run on mount. */
  trigger?: string;
  y?: number;
  duration?: number;
  stagger?: number;
  start?: string;
}

/**
 * Port of the per-page GSAP blocks that used to sit at the bottom of each
 * landing page. Animations are scoped with `gsap.context()` so React's
 * double-invoked effects in development clean up correctly.
 */
export function useGsapReveal<T extends HTMLElement>(
  steps: RevealStep[],
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  // Reveal configs are static per page, so capturing the first value is enough.
  const stepsRef = useRef(steps);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      for (const step of stepsRef.current) {
        const {
          targets,
          trigger,
          y = 40,
          duration = 0.8,
          stagger = 0.1,
          start = "top 85%",
        } = step;

        if (!container.querySelector(targets)) continue;

        gsap.from(targets, {
          opacity: 0,
          y,
          duration,
          stagger,
          ease: "power2.out",
          ...(trigger
            ? {
                scrollTrigger: {
                  trigger,
                  start,
                  toggleActions: "play none none none",
                },
              }
            : {}),
        });
      }
    }, container);

    return () => context.revert();
  }, []);

  return containerRef;
}
