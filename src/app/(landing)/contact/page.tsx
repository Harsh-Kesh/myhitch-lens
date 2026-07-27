"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { HERO_REVEAL, LandingHero } from "@/components/layout/LandingHero";
import { Button } from "@/components/ui/Button";
import { formControl, FormGroup, workspacePanel } from "@/components/ui/Form";
import { MailIcon, MapPinIcon } from "@/components/ui/icons";
import { HeroAccent } from "@/components/ui/Primitives";
import { useGsapReveal } from "@/hooks/useGsapReveal";
import { cn } from "@/lib/cn";

const TOPICS = [
  { value: "vetting", label: "Author Verification Vetting" },
  { value: "corporate", label: "Corporate Accounts & API access" },
  { value: "support", label: "Compliance & Policy Dispute Support" },
  { value: "general", label: "General Partnerships" },
];

/** Info panel heading shared by the three cards in the right column. */
const infoHeading = "m-0 flex items-center gap-2 font-heading text-base font-bold";

export default function ContactPage() {
  const rootRef = useGsapReveal<HTMLDivElement>([HERO_REVEAL]);
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0].value);
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    alert(
      `Thanks, ${name}!\nYour message has been compiled in our logs. We will contact you at ${email} within 24 hours.`,
    );
    router.push("/");
  }

  return (
    <div ref={rootRef}>
      <LandingHero
        image="/images/contact_hero.png"
        badge="Get in Touch"
        title={
          <>
            Support &amp; <HeroAccent>Partner Inquiries</HeroAccent>
          </>
        }
        subtitle="Reach out for vetting credentials issues, corporate API pricing, or compliance questions."
      />

      <main className="py-15">
        <div className="mx-auto max-w-[1100px] px-6 max-[480px]:px-5">
          <div className="flex flex-wrap gap-10 max-[768px]:gap-6">
            {/* Section 1: Form Column. The columns wrap at their preferred
                widths but stay shrinkable, so neither one forces a horizontal
                scroll on a narrow phone. */}
            <div className="min-w-0 flex-[1.2_1_320px]">
              <form
                onSubmit={handleSubmit}
                className={cn(workspacePanel, "flex flex-col gap-4")}
              >
                <FormGroup label="Full Name" htmlFor="contactName">
                  <input
                    id="contactName"
                    type="text"
                    className={formControl}
                    placeholder="Sarah Chen"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </FormGroup>

                <FormGroup label="Email Address" htmlFor="contactEmail">
                  <input
                    id="contactEmail"
                    type="email"
                    className={formControl}
                    placeholder="sarah@chenlabs.org"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </FormGroup>

                <FormGroup label="Inquiry Category" htmlFor="contactTopic">
                  <select
                    id="contactTopic"
                    className={formControl}
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                  >
                    {TOPICS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormGroup>

                <FormGroup label="Message Details" htmlFor="contactMessage">
                  <textarea
                    id="contactMessage"
                    rows={5}
                    className={formControl}
                    placeholder="Detail your query..."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    required
                  />
                </FormGroup>

                <Button type="submit" className="w-full">
                  Submit Contact Ticket
                </Button>
              </form>
            </div>

            {/* Section 2: Contact Info Column */}
            <div className="flex min-w-0 flex-[0.8_1_300px] flex-col gap-6">
              {/* Office Address Card */}
              <div
                className={cn(workspacePanel, "flex flex-col gap-3 p-6 text-left")}
              >
                <h4 className={cn(infoHeading, "text-text-main")}>
                  <MapPinIcon className="size-[18px] text-primary" />
                  HQ Operations Office
                </h4>
                <p className="m-0 text-sm leading-[1.6] text-text-muted">
                  MYHitch Global Operations Center
                  <br />
                  450 Science Drive, Suite 102
                  <br />
                  Palo Alto, CA 94301
                </p>
              </div>

              {/* Direct Help Lines Card */}
              <div
                className={cn(workspacePanel, "flex flex-col gap-3 p-6 text-left")}
              >
                <h4 className={cn(infoHeading, "text-text-main")}>
                  <MailIcon className="size-[18px] text-primary" />
                  Direct Departments
                </h4>
                <p className="m-0 text-sm leading-[1.6] text-text-muted">
                  <strong>Author Vetting:</strong> vetting@myhitch.org
                  <br />
                  <strong>Enterprise Licensing:</strong> corporate@myhitch.org
                  <br />
                  <strong>Compliance:</strong> safety@myhitch.org
                </p>
              </div>

              {/* Live Vetting Status Card */}
              <div
                className={cn(
                  workspacePanel,
                  "flex flex-col gap-3 border-primary bg-primary-glow p-6 text-left",
                )}
              >
                <h4 className={cn(infoHeading, "text-primary")}>
                  <span className="bg-primary" />
                  Vetting Board Status
                </h4>
                <p className="m-0 text-[13.5px] leading-[1.6] text-text-muted">
                  Our credentials validation committee is active. Vetting applications
                  are processed within 24-48 business hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
