"use client";

import type { ReactNode } from "react";

import { HERO_REVEAL, LandingHero } from "@/components/layout/LandingHero";
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
import { HeroAccent } from "@/components/ui/Primitives";
import { useGsapReveal } from "@/hooks/useGsapReveal";

const specIcon = "size-5 align-middle text-primary";

interface Spec {
  icon: ReactNode;
  title: string;
  intro: string;
  /** Rendered between the intro and the bullet list. */
  extra?: ReactNode;
  bullets: { term: string; text: string }[];
}

/** `.workflow-step-pill` */
const stepPill =
  "rounded-[50px] border border-line bg-bg-secondary px-[18px] py-2.5 text-[13px] font-semibold text-text-main";

const EDITORIAL_FLOW = (
  <div className="my-5 flex flex-wrap items-center justify-center gap-3">
    <span className={stepPill}>1. Draft Created</span>
    <span className="font-bold text-primary">→</span>
    <span className={stepPill}>2. AI Validation</span>
    <span className="font-bold text-primary">→</span>
    <span className={stepPill}>3. Editorial Queue</span>
    <span className="font-bold text-primary">→</span>
    <span className={stepPill}>4. Scheduled Publish</span>
  </div>
);

const SPECS: Spec[] = [
  {
    icon: <UsersIcon className={specIcon} />,
    title: "User Management",
    intro:
      "Governs how readers, vetted contributors, and publishers interact with the publishing ecosystem.",
    bullets: [
      {
        term: "User Registration & Profiles:",
        text: "Flexible onboarding profiles supporting customized reader interests, author portfolio bios, and corporate publisher listings.",
      },
      {
        term: "Verified Authors:",
        text: "Domain experts go through academic and professional vetting checks to earn a verified contribution checkmark badge.",
      },
      {
        term: "Contributor ranking:",
        text: "Authors earn score points based on article view counts, positive comment reviews, and validation logs, progressing from Bronze to Silver and Gold status tiers.",
      },
    ],
  },
  {
    icon: <CreditCardIcon className={specIcon} />,
    title: "Subscription Plans",
    intro:
      "The foundation of the platform's access control and contributor payout monetization engine.",
    bullets: [
      {
        term: "Reader Subscription ($9.99/mo):",
        text: "Grants full access to clean publication articles, commenting directories, bookmark folders, and customized alerts.",
      },
      {
        term: "Author Subscription ($29.99/mo):",
        text: "Enables verified badge vetting access, full AI assistant checking tools, SEO reports, and access to payout revenue shares.",
      },
      {
        term: "Corporate Publisher ($199/mo):",
        text: "Grants access to team collaboration accounts, report publication catalogs, and connected MYHitch procurement links.",
      },
    ],
  },
  {
    icon: <PencilIcon className={specIcon} />,
    title: "Article Submission",
    intro: "The author's content drafting workspace, supporting diverse media formats.",
    bullets: [
      {
        term: "Rich Text Editor:",
        text: "Features formatted structures, blockquotes, code fences, and links.",
      },
      {
        term: "PDF & Word parser:",
        text: "Features a drag-and-drop file ingestion module that parses documents, automatically loading titles and drafting text.",
      },
      {
        term: "Media Attachments:",
        text: "Full support for embedding infographics, short videos, audio tracks, and PDF research references.",
      },
    ],
  },
  {
    icon: <SettingsIcon className={specIcon} />,
    title: "Editorial Workflow",
    intro: "The lifecycle tracking content progress from draft to public availability.",
    extra: EDITORIAL_FLOW,
    bullets: [
      {
        term: "Vetted Authors:",
        text: "Submit draft documents. AI scanning is triggered instantly to ensure plagiarism is below compliance thresholds.",
      },
      {
        term: "Human Editors:",
        text: "Reviews drafts, provides feedback, requests revisions, or publishes content.",
      },
    ],
  },
  {
    icon: <ColumnsIcon className={specIcon} />,
    title: "Editorial Dashboard",
    intro:
      "The control room for moderators and publisher admins to schedule and curate content feeds.",
    bullets: [
      {
        term: "Review Queue:",
        text: "A centralized queue listing drafts with automated AI quality checkpoints and assignee selectors.",
      },
      {
        term: "Scheduling:",
        text: "Select release dates and times for posts to automate release calendars.",
      },
      {
        term: "Moderation:",
        text: "Review reader comment feeds, resolve disputes, and manage compliance flags.",
      },
    ],
  },
  {
    icon: <FolderIcon className={specIcon} />,
    title: "Content Categories",
    intro:
      "The taxonomical index organizing publications across 11 key operational sectors.",
    bullets: [
      {
        term: "Core Sectors:",
        text: "AI, Supply Chain, Technology, Business, Finance, Healthcare, Education, Travel, Research, Lifestyle, and Community.",
      },
      {
        term: "Dynamic Filtering:",
        text: "Allows readers to instantly filter the feed using sector tags or category grid cards.",
      },
    ],
  },
  {
    icon: <ActivityIcon className={specIcon} />,
    title: "Revenue Model",
    intro: "How the ecosystem pays vetting costs and remunerates quality authors.",
    bullets: [
      {
        term: "Payout Engine:",
        text: "Direct revenue shares allocated to verified authors based on reading time metrics.",
      },
      {
        term: "Corporate Reports:",
        text: "Allows publishers to sell premium industry reports under digital token structures.",
      },
      {
        term: "Programmatic Ads:",
        text: "Ad space revenue divided between the platform and content creators.",
      },
    ],
  },
  {
    icon: <CpuIcon className={specIcon} />,
    title: "AI Features",
    intro: "A suite of AI assistants to help format and optimize content.",
    bullets: [
      {
        term: "Plagiarism Validation:",
        text: "Semantic pattern checks ensuring high authenticity scores.",
      },
      {
        term: "Translation & Voice Synthesis:",
        text: "Multi-language translation matrices and voice narrators translating text to speech.",
      },
      {
        term: "Summarization:",
        text: "Abstract summarizer generation to outline key bullet points instantly.",
      },
    ],
  },
  {
    icon: <BookIcon className={specIcon} />,
    title: "Reader Features",
    intro: "Enhances engagement and personalization for platform subscribers.",
    bullets: [
      { term: "Reading Options:", text: "Bookmarks, Likes, and comment discussions." },
      {
        term: "Follow Creators:",
        text: "Follow favorite vetted contributors to populate customized notifications feeds.",
      },
      { term: "Preferences:", text: "Tuned typography and spacing for optimal readability." },
    ],
  },
  {
    icon: <BarChartIcon className={specIcon} />,
    title: "Analytics",
    intro: "Telemetry indicators tracking publication reach and subscriber metrics.",
    bullets: [
      {
        term: "Views & Read Time:",
        text: "Tracks individual reading durations and total view graphs.",
      },
      {
        term: "SVG Dashboards:",
        text: "Modern line charts and bar distributions tracking performance metrics in real-time.",
      },
    ],
  },
  {
    icon: <ShieldIcon className={specIcon} />,
    title: "Governance & Policy",
    intro: "Maintains credibility, copyrights, and editorial standards.",
    bullets: [
      {
        term: "Double-Blind peer reviews:",
        text: "Restricts identity disclosure during publication vetting cycles.",
      },
      {
        term: "DRM copyright tokens:",
        text: "Digital rights management keys protecting original texts against scrapers.",
      },
      {
        term: "Appeals Intake:",
        text: "Dispute tickets allowing authors to appeal moderator rejections.",
      },
    ],
  },
  {
    icon: <PowerIcon className={specIcon} />,
    title: "MYHitch Integrations",
    intro: "Connected API modules extending the usefulness of publications.",
    bullets: [
      {
        term: "Mart procurement links:",
        text: "Instantly displays physical products or hardware modules mentioned in articles.",
      },
      {
        term: "JetNRest travel SAF:",
        text: "Embeds carbon-offset flight search buttons inside travel operations articles.",
      },
      {
        term: "Consulting Schedulers & Wallet Donations:",
        text: "Connects scheduling systems and web3 donation micro-grants directly into article footers.",
      },
    ],
  },
];

/** `.spec-card` */
const specCard =
  "mb-[30px] rounded-xl border border-line bg-bg-primary p-[30px] shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary max-[768px]:mb-5 max-[480px]:p-5";

export default function FunctionsPage() {
  const rootRef = useGsapReveal<HTMLDivElement>([HERO_REVEAL]);

  return (
    <div ref={rootRef}>
      <LandingHero
        image="/images/functions_hero.png"
        badge="Technical Specification Handbook"
        title={
          <>
            Core Platform <HeroAccent>Capabilities</HeroAccent>
          </>
        }
        subtitle="A deep dive into the 12 core requirements, system architectures, and lifecycle operations governing the MYHitch Lens platform."
      />

      <main>
        <div className="mx-auto max-w-[900px] px-5 py-10">
          {SPECS.map((spec, index) => (
            <div key={spec.title} className={specCard}>
              <span className="mb-2 inline-block text-sm font-extrabold tracking-[1px] text-primary uppercase">
                {String(index + 1).padStart(2, "0")} / Specification
              </span>
              <h3 className="mb-4 flex items-center gap-2.5 font-heading text-[22px] font-bold text-text-main max-[480px]:text-[19px]">
                <span className="text-2xl">{spec.icon}</span>
                {spec.title}
              </h3>
              <p className="text-[14.5px] leading-[1.6] text-text-muted">{spec.intro}</p>
              {spec.extra}
              <ul className="mt-3 ml-5 flex list-disc flex-col gap-2">
                {spec.bullets.map((bullet) => (
                  <li
                    key={bullet.term}
                    className="text-sm leading-[1.6] text-text-muted"
                  >
                    <strong className="text-text-main">{bullet.term}</strong>{" "}
                    {bullet.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
