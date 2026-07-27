"use client";

import { HERO_REVEAL, LandingHero } from "@/components/layout/LandingHero";
import { Container, HeroAccent } from "@/components/ui/Primitives";
import { useGsapReveal } from "@/hooks/useGsapReveal";

const STEPS = [
  {
    number: "01",
    title: "Author Registration",
    text: "The author registers on the platform. To gain publishing rights, they undergo identity checks, domain validation, and credentials verification, ensuring they meet verified contribution standards.",
  },
  {
    number: "02",
    title: "Tier Subscription",
    text: "Users select their subscription plan. Readers purchase access to clean publications, authors select plans enabling writing features and earnings access, and corporate publishers acquire team licensing tools.",
  },
  {
    number: "03",
    title: "Document Ingestion",
    text: "Authors draft their reports or whitepapers inside the rich editor workspace, or drag and drop Word/PDF files. The system automatically parses headers and details into formatted text.",
  },
  {
    number: "04",
    title: "Academic Auditing",
    text: "Submitted documents run through the citation checking engine. The parser validates references, checks for cross-referenced DOI accuracy, and runs double-blind plagiarism assessments.",
  },
  {
    number: "05",
    title: "Editorial Review",
    text: "Assigned peer reviewers evaluate the submission. Feedback loops, suggested improvements, and approval checkmarks are tracked on the distributed ledger ledger system.",
  },
  {
    number: "06",
    title: "Index Distribution",
    text: "Approved articles are cryptographically signed and stored in the catalog. Digital rights keys, timestamped verification proof, and citation tags are written to immutable metadata records.",
  },
  {
    number: "07",
    title: "Reader Engagement",
    text: "Subscribed readers access publications in the explore feed. They follow verified authors, save articles to bookmarks lists, play audio narration guides, and post comments under strict double-blind guidelines.",
  },
  {
    number: "08",
    title: "Monetization",
    text: "Accumulated views and read time metrics are translated into subscriber payouts. Revenue splits are calculated, allowing creators to withdraw earnings directly to web3 wallets or bank accounts.",
  },
  {
    number: "09",
    title: "Vetting Logs Audit",
    text: "The entire publication audit history remains accessible in the public logs portal. Compliance officers, academic boards, and readers verify the peer-review timeline and validator approvals.",
  },
];

/** `.workflow-card` from the page-scoped <style> block. */
const workflowCard =
  "flex flex-col gap-5 rounded-2xl border border-line bg-bg-primary p-8 text-left transition-all duration-[250ms] hover:-translate-y-[5px] hover:border-primary max-[480px]:p-6";

export default function WorkflowPage() {
  const rootRef = useGsapReveal<HTMLDivElement>([
    { ...HERO_REVEAL, y: 20, duration: 0.6, stagger: 0.1 },
  ]);

  return (
    <div ref={rootRef}>
      <LandingHero
        image="/images/workflow_hero.jpg"
        imagePosition="left"
        badge="Platform Lifecycle"
        title={
          <>
            The Publication <HeroAccent>Lifecycle</HeroAccent> Workflow
          </>
        }
        subtitle="How content is generated, vetted, reviewed, distributed, and monetized within our ecosystem."
      />

      <main className="py-15">
        <Container>
          {/* Workflow Steps Grid */}
          <div className="mt-10 grid w-full grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-[30px] max-[480px]:gap-5">
            {STEPS.map((step) => (
              <div key={step.number} className={workflowCard}>
                <div className="flex size-12 items-center justify-center rounded-xl border border-primary bg-primary-glow text-lg font-extrabold text-primary">
                  {step.number}
                </div>
                <h3 className="m-0 font-heading text-xl leading-[1.25] font-bold text-text-main max-[480px]:text-lg">
                  {step.title}
                </h3>
                <p className="m-0 text-[14.5px] leading-[1.6] text-text-muted">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </main>
    </div>
  );
}
