"use client";

import { HERO_REVEAL, LandingHero } from "@/components/layout/LandingHero";
import { HeroAccent } from "@/components/ui/Primitives";
import { useGsapReveal } from "@/hooks/useGsapReveal";

const SECTIONS = [
  {
    heading: "Our Vision",
    body: "In an era overwhelmed by high-volume AI-generated spam and non-vetted opinion articles, MYHitch Lens was created to stand as a dedicated fortress of credibility. Our mission is to restore trust in corporate reports, research papers, news, and specialized blogs.",
  },
  {
    heading: "Vetted Contributors",
    body: "We restrict publishing access to individuals and corporate accounts that pass our strict verification checklists (domain matching, professional citation histories, and social profiles). Authors earn score ratings and reputation badges as they build their portfolios.",
  },
  {
    heading: "AI as an Assistant, Not the Creator",
    body: "At MYHitch Lens, direct generation of publications via AI models is prohibited. Instead, our AI suite serves as a supportive assistant—offering grammar checks, plagiarism index evaluations, abstract summaries, translation matrices, and automated vocal narration tracks to optimize content formatting and reach.",
  },
  {
    heading: "Human Editorial Integrity",
    body: "Every article submitted must successfully navigate our review queue moderated by senior compliance editors. This ensures all pieces adhere to copyright guidelines, satisfy editorial standards, and contain verifiable citations before going live.",
  },
];

export default function AboutPage() {
  const rootRef = useGsapReveal<HTMLDivElement>([HERO_REVEAL]);

  return (
    <div ref={rootRef}>
      <LandingHero
        image="/images/about_hero.png"
        badge="Trusted Knowledge. Verified Voices."
        title={
          <>
            Platform Mission &amp; <HeroAccent>Core Philosophy</HeroAccent>
          </>
        }
        subtitle="Discover how MYHitch Lens balances advanced artificial intelligence tools with rigorous human moderation guidelines to protect data credibility."
      />

      <main className="py-15">
        <div className="mx-auto max-w-[800px] px-6 max-[480px]:px-5">
          {/* `.editor-workspace` reused as a long-form reading panel */}
          <div className="flex flex-col gap-6 rounded-xl border border-line bg-bg-secondary p-10 text-[15.5px] leading-[1.8] text-text-muted max-[768px]:p-7 max-[480px]:p-5 max-[480px]:text-[15px]">
            {SECTIONS.map((section) => (
              <div key={section.heading} className="contents">
                <h3 className="font-heading text-lg leading-[1.25] font-bold text-text-main">
                  {section.heading}
                </h3>
                <p>{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
