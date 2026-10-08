"use client";

import { useState } from "react";

import { HERO_REVEAL, LandingHero } from "@/components/layout/LandingHero";
import { type ButtonVariant } from "@/components/ui/Button";
import { Container, HeroAccent } from "@/components/ui/Primitives";
import { useGsapReveal } from "@/hooks/useGsapReveal";
import { cn } from "@/lib/cn";
import { PLANS as CATALOGUE, formatAud, type BillingInterval, type PlanCode } from "@/lib/plans";

import { PlanCta } from "./PlanCta";

interface Plan {
  code: PlanCode;
  badge?: string;
  title: string;
  price: string;
  period: string;
  yearly?: string;
  desc: string;
  features: string[];
  excluded?: string[];
  cta: string;
  href: string;
  variant: ButtonVariant;
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    code: "free",
    title: "Lens Free",
    price: "AU$0",
    period: "forever free",
    desc: "Start your journey on MYHitch Lens.",
    features: [
      "Read public articles",
      "Create author profile",
      "Submit up to 2 articles per month",
      "Basic images in articles",
      "Comment, like and share",
      "Follow authors and topics",
      "Bookmark articles",
      "Basic article analytics",
      "AI writing assistance (limited)",
      "MYHitch editorial approval",
    ],
    excluded: [
      "Video/Media embedding",
      "SEO tools",
      "Schedule publishing",
      "Monetisation eligibility",
      "Sponsored articles",
      "Business profile",
    ],
    cta: "Get Started Free",
    href: "/auth/login?mode=signup&role=reader",
    variant: "secondary",
  },
  {
    code: "creator",
    title: "Lens Creator",
    price: "AU$9.99",
    period: "/ month",
    yearly: "or AU$99 / year (Save 17%)",
    desc: "For bloggers, students and emerging writers.",
    features: [
      "All Free plan features",
      "Submit up to 10 articles per month",
      "Images and media in articles",
      "Video embedding",
      "Standard article analytics",
      "AI writing assistance",
      "Grammar and style check",
      "Basic SEO optimisation",
      "Schedule publishing",
      "Eligible for Verified Author badge",
      "Follow author performance",
      "MYHitch editorial approval",
    ],
    excluded: [
      "Advanced analytics",
      "Monetisation tools",
      "Sponsored articles",
      "Business profile",
      "Multiple users",
    ],
    cta: "Choose Creator Plan",
    href: "/auth/login?mode=signup&role=author",
    variant: "secondary",
  },
  {
    badge: "Most Popular",
    code: "professional",
    title: "Lens Professional",
    price: "AU$19.99",
    period: "/ month",
    yearly: "or AU$199 / year (Save 17%)",
    desc: "For journalists, researchers and industry experts.",
    features: [
      "All Creator plan features",
      "Unlimited article submissions",
      "Advanced article analytics",
      "Advanced AI writing assistance",
      "Grammar and style check",
      "Advanced SEO tools",
      "Schedule publishing",
      "Priority editorial review",
      "Monetisation eligibility",
      "Publish sponsored articles",
      "Eligible for Verified Author badge",
      "MYHitch ecosystem promotion",
      "Author audience insights",
      "Custom article categories (subject to approval)",
    ],
    cta: "Choose Professional Plan",
    href: "/auth/login?mode=signup&role=author",
    variant: "primary",
    featured: true,
  },
  {
    code: "business",
    title: "Lens Business",
    price: "AU$49.99",
    period: "/ month",
    yearly: "or AU$499 / year (Save 17%)",
    desc: "For companies, organisations and media publishers.",
    features: [
      "All Professional plan features",
      "Branded company/organisation profile",
      "5 author/user accounts included",
      "Additional users at AU$5/user/month",
      "Team management and roles",
      "Advanced analytics dashboard",
      "Publish unlimited articles",
      "Sponsored content capability",
      "Advertising campaign tools (separate fees apply)",
      "Priority editorial review",
      "MYHitch ecosystem promotion (priority)",
      "Lead generation tools",
      "Custom branding options",
      "Dedicated account support",
    ],
    cta: "Choose Business Plan",
    href: "/auth/login?mode=signup&role=corporate",
    variant: "secondary",
  },
];

/** `.pricing-card` */
const pricingCard =
  "relative flex flex-col rounded-2xl border p-7 pt-9 transition-all duration-300 hover:-translate-y-2 hover:border-line-hover hover:shadow-card";

export default function PricingPage() {
  const rootRef = useGsapReveal<HTMLDivElement>([HERO_REVEAL]);
  const [interval, setInterval] = useState<BillingInterval>("month");

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
        subtitle="Select the tier that matches your goals, from free readers to global publishers."
      />

      <main className="py-15">
        <Container>
          <div className="mx-auto mt-10 flex w-fit items-center gap-1 rounded-full border border-line bg-bg-secondary p-1 text-[13px] font-semibold">
            {(["month", "year"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setInterval(value)}
                className={cn(
                  "cursor-pointer rounded-full px-5 py-2 transition-colors",
                  interval === value ? "bg-primary text-text-inverse" : "text-text-muted hover:text-text-main",
                )}
              >
                {value === "month" ? "Monthly" : "Yearly (save 17%)"}
              </button>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4 max-md:mx-auto max-md:max-w-[480px]">
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
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3.5 py-1 text-[11px] font-bold tracking-[0.5px] whitespace-nowrap text-text-inverse uppercase">
                    {plan.badge}
                  </div>
                )}

                <h3 className="mb-2 font-heading text-[22px] font-bold text-text-main">
                  {plan.title}
                </h3>
                <p className="mb-5 min-h-[40px] text-[13.5px] leading-snug text-text-muted">
                  {plan.desc}
                </p>

                <div className="flex flex-wrap items-baseline gap-x-1.5 font-heading text-text-main">
                  <span className="text-[32px] leading-tight font-extrabold whitespace-nowrap">
                    {interval === "year" && CATALOGUE[plan.code].yearlyCents
                      ? formatAud(CATALOGUE[plan.code].yearlyCents!)
                      : plan.price}
                  </span>
                  <span className="text-sm font-medium whitespace-nowrap text-text-muted">
                    {interval === "year" && CATALOGUE[plan.code].yearlyCents ? "/ year" : plan.period}
                  </span>
                </div>
                <p className="mt-1 mb-6 min-h-[20px] text-[13px] text-text-muted">
                  {interval === "year" && CATALOGUE[plan.code].yearlyCents
                    ? `That's ${formatAud(Math.round(CATALOGUE[plan.code].yearlyCents! / 12))} / month, billed yearly`
                    : plan.yearly}
                </p>

                <PlanCta
                  code={plan.code}
                  interval={interval}
                  label={plan.cta}
                  variant={plan.variant}
                  freeHref={plan.href}
                />

                <ul className="mt-6 flex flex-1 list-none flex-col gap-3 border-t border-line pt-6">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "pricing-check flex items-start gap-2.5 text-[13.5px] leading-snug",
                        plan.featured && "pricing-check-accent",
                      )}
                    >
                      {feature}
                    </li>
                  ))}
                  {plan.excluded?.map((feature) => (
                    <li
                      key={feature}
                      className="pricing-cross flex items-start gap-2.5 text-[13.5px] leading-snug text-text-muted opacity-60"
                    >
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </main>
    </div>
  );
}
