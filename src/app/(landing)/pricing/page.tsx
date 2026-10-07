"use client";

import Link from "next/link";

import { HERO_REVEAL, LandingHero } from "@/components/layout/LandingHero";
import { buttonClasses, type ButtonVariant } from "@/components/ui/Button";
import { Container, HeroAccent } from "@/components/ui/Primitives";
import { useGsapReveal } from "@/hooks/useGsapReveal";
import { cn } from "@/lib/cn";

interface Plan {
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
  "relative flex flex-col rounded-2xl border p-8 py-10 transition-all duration-300 hover:-translate-y-2 hover:border-line-hover hover:shadow-card";

/** `.pricing-badge` */
const pricingBadge =
  "mb-4 self-start rounded border px-2.5 py-1 text-[11px] font-bold tracking-[0.5px] uppercase";

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
        subtitle="Select the tier that matches your goals, from free readers to global publishers."
      />

      <main className="py-15">
        <Container>
          <div className="mt-10 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4 max-md:mx-auto max-md:max-w-[480px]">
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
                )}

                <h3 className="mb-4 font-heading text-[22px] font-bold text-text-main">
                  {plan.title}
                </h3>
                <div className="mb-6 font-heading text-[34px] font-extrabold text-text-main">
                  {plan.price}
                  <span className="text-[15px] font-medium text-text-muted">
                    {plan.period}
                  </span>
                </div>
                {plan.yearly && (
                  <p className="-mt-4 mb-6 text-[13px] text-text-muted">
                    {plan.yearly}
                  </p>
                )}
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
                  {plan.excluded?.map((feature) => (
                    <li
                      key={feature}
                      className="pricing-cross flex items-center gap-2.5 text-[13.5px] text-text-muted opacity-60"
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
