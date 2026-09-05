"use client";

import type { ReactNode } from "react";

import { LandingHero } from "@/components/layout/LandingHero";
import { ButtonLink } from "@/components/ui/Button";
import {
  ActivityIcon,
  BarChartIcon,
  BookIcon,
  ColumnsIcon,
  CpuIcon,
  CreditCardIcon,
  FolderIcon,
  PencilIcon,
  PowerIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/icons";
import {
  BadgePill,
  Container,
  HeroAccent,
  HeroBadge,
  SectionSubtitle,
  SectionTitle,
} from "@/components/ui/Primitives";
import { HERO_REVEAL } from "@/components/layout/LandingHero";
import { useGsapReveal } from "@/hooks/useGsapReveal";

const STATS = [
  { value: "15K+", label: "Verified Authors" },
  { value: "120K+", label: "Published Articles" },
  { value: "99.8%", label: "Plagiarism Free" },
  { value: "35M+", label: "Monthly Readers" },
];

const iconClass = "size-6 text-primary";

/** The 12 platform specifications rendered in the ecosystem index grid. */
const CAPABILITIES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <UsersIcon className={iconClass} />,
    title: "User Management",
    desc: "Author portfolios, ranking tiers (Bronze to Gold), vetted profiles, and corporate publisher onboarding logs.",
  },
  {
    icon: <CreditCardIcon className={iconClass} />,
    title: "Subscription Tiers",
    desc: "Access-controlled options (Reader, Author, Publisher) supporting payment gateways and analytics telemetry.",
  },
  {
    icon: <PencilIcon className={iconClass} />,
    title: "Submission Workspace",
    desc: "Draft whitepapers inside the rich editor, or upload Word/PDF files to trigger automatic parsing routines.",
  },
  {
    icon: <SettingsIcon className={iconClass} />,
    title: "Vetting Workflows",
    desc: "Structured routes pushing drafts through real-time quality scanning before loading into editor workspaces.",
  },
  {
    icon: <ColumnsIcon className={iconClass} />,
    title: "Editorial Dashboards",
    desc: "Allows moderator compliance boards to assign reviewers, schedule releases, and moderate discussion boards.",
  },
  {
    icon: <FolderIcon className={iconClass} />,
    title: "11 Curated Categories",
    desc: "Publications cataloged under Business, Supply Chain, Technology, AI, Healthcare, Education, Travel, Finance, Lifestyle, Research, and Community.",
  },
  {
    icon: <ActivityIcon className={iconClass} />,
    title: "Ecosystem Monetization",
    desc: "Split ad-share revenue payouts, sell premium reports, or earn direct subscriptions based on user reading durations.",
  },
  {
    icon: <CpuIcon className={iconClass} />,
    title: "AI Quality Assistants",
    desc: "Generative helpers evaluating plagiarism check scores, generating summaries, and rendering vocal audio narrations.",
  },
  {
    icon: <BookIcon className={iconClass} />,
    title: "Reader Engagement",
    desc: "Personalized alert dashboards, bookmark collections, comment boards, followed writers, and reading history.",
  },
  {
    icon: <BarChartIcon className={iconClass} />,
    title: "Telemetry Analytics",
    desc: "Interactive SVG dashboards showing view trends, categories interest, payout estimates, and user retention levels.",
  },
  {
    icon: <ShieldIcon className={iconClass} />,
    title: "Governance Bylaws",
    desc: "Appeals dispute workflows, compliance monitoring, DRM copyright protection, and double-blind peer review.",
  },
  {
    icon: <PowerIcon className={iconClass} />,
    title: "MYHitch Integrations",
    desc: "Embed Mart product procurement links, JetNRest travel offset forms, and consulting event booking calendars.",
  },
];

const TIMELINE = [
  {
    title: "1. Draft Ingestion",
    desc: "Upload Word/PDF drafts. Automated parsing extracts outline details.",
  },
  {
    title: "2. AI Optimization",
    desc: "Quality Assistant checks grammar, generates summaries, and handles SEO tags.",
  },
  {
    title: "3. Peer Review",
    desc: "Double-blind vetting workflow routing drafts to specialized reviewers.",
  },
  {
    title: "4. DRM Minting",
    desc: "Approved drafts are hashed, timestamped, and issued DRM tokens.",
  },
  {
    title: "5. Publishing Payout",
    desc: "Article goes live and becomes searchable, with direct Mart commerce linking and payouts.",
  },
];

/** `.capability-card` */
const capabilityCard =
  "rounded-lg border border-line bg-bg-primary p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_4px_20px_var(--shadow-color)]";

export default function HomePage() {
  const mainRef = useGsapReveal<HTMLElement>([
    { ...HERO_REVEAL, y: 35, duration: 1 },
    {
      targets: ".stats-section .stat-card",
      trigger: ".stats-section",
      stagger: 0.12,
    },
    {
      targets:
        ".workflow-section .section-title, .workflow-section .section-subtitle, .workflow-section .timeline-node, .workflow-section .cta-btn",
      trigger: ".workflow-section",
    },
    {
      targets:
        ".partnership-cta-section .hero-badge, .partnership-cta-section .section-title, .partnership-cta-section .section-subtitle, .partnership-cta-section .cta-btn",
      trigger: ".partnership-cta-section",
      y: 45,
      duration: 0.9,
      stagger: 0.15,
    },
  ]);

  return (
    <main ref={mainRef}>
      {/* Hero Section */}
      <LandingHero
        image="/images/home_hero.png"
        badge="Vision: Trusted Knowledge. Verified Voices."
        title={
          <>
            Where Experts Write and <HeroAccent>AI Refines</HeroAccent>.
          </>
        }
        subtitle="The publishing platform designed for verified authors, corporate publishers, and high-impact research. Combining rigorous editorial workflows with cutting-edge AI features."
      />

      {/* Platform Statistics */}
      <section className="stats-section border-y border-line bg-bg-secondary py-10">
        {/* Wrapping four stats one-per-row reads as a stack of orphans, so
            phones get a tidy 2x2 instead. */}
        <Container className="flex flex-wrap justify-around gap-6 max-[640px]:grid max-[640px]:grid-cols-2 max-[640px]:gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="stat-card text-center">
              <h3 className="mb-1 font-heading text-[38px] font-extrabold text-primary max-[480px]:text-[30px]">
                {stat.value}
              </h3>
              <p className="text-[13px] tracking-[1px] text-text-muted uppercase max-[480px]:text-[11.5px] max-[480px]:tracking-[0.5px]">
                {stat.label}
              </p>
            </div>
          ))}
        </Container>
      </section>

      {/* Features Showcase Grid (12 Capabilities) */}
      <section
        id="features"
        className="border-b border-line bg-bg-primary py-20 max-[768px]:py-14"
      >
        <Container className="text-center">
          <div className="mx-auto mb-10 max-w-[600px] text-center">
            <BadgePill className="mb-6">Ecosystem Index</BadgePill>
            <SectionTitle className="mt-3">
              Core Platform Functions &amp; Vetting Capabilities
            </SectionTitle>
            <SectionSubtitle>
              A verified workspace built strictly to the 12 platform specifications
              ensuring trust, safe revenue, and advanced editorial reviews.
            </SectionSubtitle>
          </div>

          <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-5 text-left">
            {CAPABILITIES.map((capability) => (
              <div key={capability.title} className={capabilityCard}>
                <div className="mb-3 text-2xl">{capability.icon}</div>
                <h3 className="mb-2 font-heading text-base leading-[1.25] font-bold text-text-main">
                  {capability.title}
                </h3>
                <p className="text-[13px] leading-[1.5] text-text-muted">
                  {capability.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-[50px]">
            <ButtonLink
              href="/functions"
              size="lg"
              className="max-[480px]:w-full max-[480px]:text-sm"
            >
              View Detailed Technical Specifications →
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Platform Workflow Diagram (Editorial Flow) */}
      <section
        id="workflow"
        className="workflow-section border-t border-line bg-bg-primary py-20 max-[768px]:py-14"
      >
        <div className="mx-auto max-w-[1100px] px-5 text-center">
          <div className="mb-[50px]">
            <BadgePill className="mb-3">Publication Lifecycle</BadgePill>
            <h2 className="section-title mb-4 font-heading text-[32px] leading-[1.25] font-extrabold text-text-main max-[768px]:text-[26px] max-[480px]:text-[23px]">
              The Landscape Workflow Timeline
            </h2>
            <p className="section-subtitle mx-auto max-w-[600px] text-base text-text-muted">
              Trace the structural lifecycle of articles as they progress through our
              vetting, AI optimization, peer review, and monetization channels.
            </p>
          </div>

          {/* Landscape Timeline Grid */}
          <div className="relative my-10 flex flex-nowrap items-start justify-between gap-5 overflow-x-auto overflow-y-hidden pb-5">
            {/* Connecting line background */}
            <div className="absolute top-[22px] right-[10%] left-[10%] z-1 h-0.5 bg-line" />

            {TIMELINE.map((step, index) => (
              <div
                key={step.title}
                className="timeline-node relative z-2 min-w-[180px] flex-1 text-center"
              >
                <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border-2 border-primary bg-bg-primary text-[15px] font-extrabold text-primary shadow-[0_0_0_4px_var(--bg-primary),0_0_12px_var(--primary-glow)] transition-all duration-300">
                  {index + 1}
                </div>
                <h4 className="mb-2 font-heading text-[15px] font-bold text-text-main">
                  {step.title}
                </h4>
                <p className="px-2.5 text-[12.5px] leading-[1.5] text-text-muted">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <ButtonLink
              href="/workflow"
              variant="secondary"
              size="lg"
              className="cta-btn max-[480px]:w-full max-[480px]:text-sm"
            >
              View Detailed Workflow Timeline →
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Corporate Partnership Section */}
      <section className="partnership-cta-section border-y border-line bg-bg-secondary py-20 text-center max-[768px]:py-14">
        <div className="mx-auto max-w-[800px] px-5">
          <HeroBadge className="hero-badge mb-4">
            Corporate &amp; Academic Publishing
          </HeroBadge>
          <h2 className="section-title mb-4 font-heading text-[32px] leading-[1.25] font-extrabold text-text-main max-[768px]:text-[26px] max-[480px]:text-[23px]">
            Enterprise Solutions for Modern Publisher Standards
          </h2>
          <p className="section-subtitle mx-auto mb-8 max-w-[680px] text-base leading-[1.8] text-text-muted max-[480px]:text-[15px]">
            Connect your logistics journals, academic institution reviews, or technical
            departments directly to the MYHitch verification engine. Enforce credentials
            vetting, automate double-blind review queues, and secure copyright DRM
            protection.
          </p>
          <ButtonLink
            href="/contact?subject=Partnership"
            size="lg"
            className="cta-btn max-[480px]:w-full max-[480px]:text-sm"
          >
            Get in Touch with our Partnerships Team →
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
