"use client";

import Link from "next/link";

import { HERO_REVEAL, LandingHero } from "@/components/layout/LandingHero";
import { buttonClasses, type ButtonVariant } from "@/components/ui/Button";
import { Container, HeroAccent } from "@/components/ui/Primitives";
import { useGsapReveal } from "@/hooks/useGsapReveal";
import { cn } from "@/lib/cn";

interface Plan {
  badge: string;
  title: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  href: string;
  variant: ButtonVariant;
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    badge: "Free / Premium",
    title: "Reader",
    price: "$9.99",
    period: "/mo",
    desc: "For professionals seeking verified insight and niche industry analysis.",
    features: [
      "Unlimited access to basic articles",
      "Bookmark & Comment options",
      "Follow verified authors",
      "Personalized reading preferences",
      "Custom notifications feed",
    ],
    cta: "Subscribe as Reader",
    href: "/auth?mode=signup&role=reader",
    variant: "secondary",
  },
  {
    badge: "Recommended",
    title: "Author",
    price: "$29.99",
    period: "/mo",
    desc: "For domain experts, researchers, and professional freelance writers.",
    features: [
      "Verified writer badge upon vetting",
      "AI writing assistant (Summaries, Narration)",
      "Full SEO recommendation tools",
      "Personalized author portfolio page",
      "Analytics dashboard (views, reading time)",
      "Direct subscriber revenue sharing",
    ],
    cta: "Start Writing",
    href: "/auth?mode=signup&role=author",
    variant: "primary",
    featured: true,
  },
  {
    badge: "Enterprise",
    title: "Corporate Publisher",
    price: "$199",
    period: "/mo",
    desc: "For research institutes, supply chain businesses, and corporate teams.",
    features: [
      "Multiple publisher accounts (up to 10)",
      "Premium report publication & sales",
      "Advanced analytics & team performance",
      "Direct MYHitch Mart products linking",
      "Priority editorial review queue",
      "API access to reader metrics",
    ],
    cta: "Launch Team Account",
    href: "/auth?mode=signup&role=editor",
    variant: "secondary",
  },
];

/** `.pricing-card` */
const pricingCard =
  "relative flex flex-col rounded-2xl border p-8 py-10 transition-all duration-300 hover:-translate-y-2 hover:border-line-hover hover:shadow-card";

/** `.pricing-badge` */
const pricingBadge =
  "absolute top-6 right-6 rounded border px-2.5 py-1 text-[11px] font-bold tracking-[0.5px] uppercase";

export default function PricingPage() {
  const rootRef = useGsapReveal<HTMLDivElement>([HERO_REVEAL]);

  return (
    <div ref={rootRef}>
      <LandingHero
        image="/images/pricing_hero.png"
        badge="Subscription Packages"
        title={
          <>
            Flexible Plans for Our <HeroAccent>Diverse Ecosystem</HeroAccent>
          </>
        }
        subtitle="Select the tier that matches your goals. Verified authors share directly in subscriber payouts."
      />

      <main className="py-15">
        <Container>
          {/* A 320px floor drops to two columns at ~1024px, leaving the third
              tier stranded on its own row. 290px keeps all three side by side
              right down to the 992px single-column cutover. */}
          <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(min(290px,100%),1fr))] items-stretch gap-[30px] max-[992px]:mx-auto max-[992px]:max-w-[480px] max-[992px]:grid-cols-1 max-[992px]:gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.title}
                className={cn(
                  pricingCard,
                  plan.featured
                    ? "border-primary bg-bg-tertiary shadow-[0_10px_40px_-10px_var(--primary-glow)]"
                    : "border-line bg-bg-secondary",
                )}
              >
                <div
                  className={cn(
                    pricingBadge,
                    plan.featured
                      ? "border-transparent bg-primary text-text-inverse"
                      : "border-line bg-bg-primary text-text-muted",
                  )}
                >
                  {plan.badge}
                </div>

                <h3 className="mb-4 font-heading text-[22px] font-bold text-text-main">
                  {plan.title}
                </h3>
                <div className="mb-6 font-heading text-[40px] font-extrabold text-text-main">
                  {plan.price}
                  <span className="text-[15px] font-medium text-text-muted">
                    {plan.period}
                  </span>
                </div>
                <p className="mb-8 text-sm text-text-muted">{plan.desc}</p>

                <ul className="mb-10 flex flex-1 list-none flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "pricing-check flex items-center gap-2.5 text-[13.5px]",
                        plan.featured && "pricing-check-accent",
                      )}
                    >
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={buttonClasses(plan.variant, "md", "w-full")}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </Container>
      </main>
    </div>
  );
}
