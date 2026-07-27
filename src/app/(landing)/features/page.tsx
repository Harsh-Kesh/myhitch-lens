"use client";

import { useState, type ReactNode } from "react";

import { HERO_REVEAL, LandingHero } from "@/components/layout/LandingHero";
import { buttonClasses } from "@/components/ui/Button";
import { FeatureCard, featuresGrid } from "@/components/ui/FeatureCard";
import {
  BarChartIcon,
  CheckCircleIcon,
  CpuIcon,
  DollarSignIcon,
  EditSquareIcon,
  PackageIcon,
  ShieldIcon,
  ShoppingCartIcon,
  UsersGroupIcon,
} from "@/components/ui/icons";
import { BadgePill, Container, HeroAccent } from "@/components/ui/Primitives";
import { useGsapReveal } from "@/hooks/useGsapReveal";
import { cn } from "@/lib/cn";

const featureIcon = "size-6";

const FEATURES = [
  {
    icon: <UsersGroupIcon className={featureIcon} />,
    title: "Verified Contributor Profiles",
    text: "We restrict publishing access to domain experts and corporate profiles who successfully pass credentials vetting procedures. Vetted authors receive a verified badge, build an indexed public portfolio, and rank based on contributions.",
  },
  {
    icon: <EditSquareIcon className={featureIcon} />,
    title: "Rich Ingestion Workspace",
    text: "Submit publications with ease. Our workspace supports uploading Word docs or PDFs, executing direct parsing routines to extract headlines and text. Embed figures, charts, Nexus explainer videos, and audio narrations directly.",
  },
  {
    icon: <PackageIcon className={featureIcon} />,
    title: "AI Quality Assistant",
    text: "Optimized generative models scan drafts to check grammar errors, detect plagiarism risks, translate texts across 4 languages, generate abstract summaries, index SEO keywords, and compile audio narration files.",
  },
  {
    icon: <CheckCircleIcon className={featureIcon} />,
    title: "Editorial Vetting Workflow",
    text: "Ensure quality standards with structured editorial boards. Assign drafts to specific editors, write revision requirements, schedule release times, moderate comment feeds, and re-classify categories inside the dashboard.",
  },
  {
    icon: <BarChartIcon className={featureIcon} />,
    title: "Telemetry Analytics",
    text: "Monitor readers' activities in real-time. View SVG charts graphing monthly view trends, reader retention levels, category focus shares, subscriber growth, and estimated revenue payouts.",
  },
  {
    icon: <DollarSignIcon className={featureIcon} />,
    title: "Monetization Hub",
    text: "Authors and publishers monetize their knowledge. Tiers support subscription revenue payouts based on user read times, sponsored posts, paid corporate report downloads, and direct programmatic ad splits.",
  },
];

type BlueprintKey = "chain" | "ai" | "mart";

interface Blueprint {
  tab: string;
  title: string;
  icon: ReactNode;
  desc: string;
  bullets: string[];
  simulatorTitle: string;
  simulator: string;
}

const blueprintIcon = "size-[22px] text-primary";

const BLUEPRINTS: Record<BlueprintKey, Blueprint> = {
  chain: {
    tab: "Vetting & DRM Protocols",
    title: "Credentials Vetting & DRM Protocols",
    icon: <ShieldIcon className={blueprintIcon} />,
    desc: "We protect the integrity of knowledge. Every author submitting to MYHitch Lens goes through a multi-tier credentials verification. Approved articles are cryptographically hashed and assigned decentralized digital rights management (DRM) tokens to prove origin timestamps and prevent unauthorized text scraping.",
    bullets: [
      "Decentralized author rank indexing",
      "Double-blind peer review automation",
      "Cryptographic timestamp hash keys",
    ],
    simulatorTitle: "DRM PROTOCOL SIMULATOR",
    simulator: `> Verifying Author: Dr. Sarah Chen
> Credentials Rating: GOLD (98.6%)
> Document Hashing: SHA-256 ...
> Generating DRM Token: OK
> Status: SECURE_DRM_VERIFIED`,
  },
  ai: {
    tab: "Intelligent Telemetry AI",
    title: "Intelligent Telemetry AI",
    icon: <CpuIcon className={blueprintIcon} />,
    desc: "Get real-time insights on your data flow. Our integrated AI suite automatically parses incoming Word and PDF publications, generates readable summaries, recommends optimized SEO tags, checks grammar structures, and translates text.",
    bullets: [
      "Direct document file parsing",
      "Keyword semantic extraction",
      "Neural voice narration synthesis",
    ],
    simulatorTitle: "DRM PROTOCOL SIMULATOR",
    simulator: `> Scanning Document Patterns...
> Summary: "The Decoupling of Global Supply..."
> Suggested Keywords: "AI Logistics", "Near-shoring"
> Translation status: French (Français) - OK
> Output: AI_ANALYSIS_COMPLETED`,
  },
  mart: {
    tab: "MYHitch Mart Procurement",
    title: "MYHitch Mart Procurement",
    icon: <ShoppingCartIcon className={blueprintIcon} />,
    desc: "An intelligent commerce bridge. With MYHitch Mart integration enabled, reading a technical article dynamically renders matched product list recommendations for supply chain materials, logistics equipment, or server computing nodes.",
    bullets: [
      "Automatic semantic product matching",
      "Direct checkout link mapping",
      "Vetted supply chain inventory connections",
    ],
    simulatorTitle: "DRM PROTOCOL SIMULATOR",
    simulator: `> Scanning article terms...
> Detected: "regional warehouse", "lead times"
> Matches Found in Mart:
  - Smart Telemetry Tracker v3.2 ($249.00)
  - Asset Corridors Routing license ($85.00/mo)
> Status: COMMERCE_LINKS_ACTIVE`,
  },
};

const BLUEPRINT_ORDER: BlueprintKey[] = ["chain", "ai", "mart"];

export default function FeaturesPage() {
  const mainRef = useGsapReveal<HTMLDivElement>([HERO_REVEAL]);
  const [activeKey, setActiveKey] = useState<BlueprintKey>("chain");
  const active = BLUEPRINTS[activeKey];

  return (
    <div ref={mainRef}>
      <LandingHero
        image="/images/features_hero.png"
        badge="Platform Capabilities"
        title={
          <>
            Core Ecosystem <HeroAccent>Features</HeroAccent>
          </>
        }
        subtitle="A breakdown of the specialized capabilities designed for verified experts, academic researchers, and enterprise publishers."
      />

      <main className="py-15">
        <Container>
          <div className={featuresGrid}>
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} icon={feature.icon} title={feature.title}>
                {feature.text}
              </FeatureCard>
            ))}
          </div>
        </Container>
      </main>

      {/* Interactive Platform Capabilities Blueprint */}
      <section className="border-y border-line bg-bg-secondary py-20 max-[768px]:py-14">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="mb-[50px] text-center max-[768px]:mb-10">
            <BadgePill className="mb-3">Technical Blueprint</BadgePill>
            <h2 className="mb-4 font-heading text-[32px] leading-[1.25] font-extrabold text-text-main max-[768px]:text-[26px] max-[480px]:text-[23px]">
              Interactive Platform Capabilities Explorer
            </h2>
            <p className="mx-auto max-w-[600px] text-base text-text-muted max-[480px]:text-[15px]">
              Select an operational pillar below to explore how our verification
              technology secures journals, ledgers, and publications.
            </p>
          </div>

          <div className="mb-10 flex flex-wrap justify-center gap-3">
            {BLUEPRINT_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveKey(key)}
                aria-pressed={key === activeKey}
                className={cn(
                  buttonClasses(
                    "secondary",
                    "md",
                    "px-5 py-2.5 text-[13.5px] max-[560px]:w-full max-[560px]:px-4",
                  ),
                  key === activeKey && "border-primary bg-primary text-white",
                )}
              >
                {BLUEPRINTS[key].tab}
              </button>
            ))}
          </div>

          <div className="grid min-h-[380px] grid-cols-[1fr_1.2fr] items-center gap-10 rounded-xl border border-line bg-bg-primary p-10 max-[992px]:grid-cols-1 max-[768px]:gap-6 max-[768px]:p-6 max-[480px]:p-5">
            {/* Left: details */}
            <div>
              <div className="mb-5 inline-flex size-11 items-center justify-center rounded-full bg-primary-glow">
                {active.icon}
              </div>
              <h3 className="mb-4 font-heading text-2xl leading-[1.25] font-extrabold text-text-main max-[480px]:text-xl">
                {active.title}
              </h3>
              <p className="mb-6 text-sm leading-[1.7] text-text-muted">{active.desc}</p>
              <ul className="list-disc pl-5 text-[13.5px] leading-[2] text-text-muted">
                {active.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>

            {/* Right: interactive simulator */}
            <div className="flex h-full min-h-[300px] flex-col justify-center gap-4 rounded-lg border border-line bg-bg-secondary p-6 font-mono text-[12.5px] text-text-main max-[480px]:min-h-[240px] max-[480px]:p-4 max-[480px]:text-[11.5px]">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-3 font-bold text-primary">
                <span>{active.simulatorTitle}</span>
                <span className="shrink-0 rounded border border-[#2da4df] px-1.5 py-0.5 text-[11px] text-[#2da4df]">
                  ACTIVE
                </span>
              </div>
              <div className="leading-[1.6] break-all whitespace-pre-wrap">
                {active.simulator}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
