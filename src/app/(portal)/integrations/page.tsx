"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import {
  BookIcon,
  BriefcaseIcon,
  CheckIcon,
  FilmIcon,
  HeartIcon,
  SendIcon,
  ShoppingCartIcon,
} from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { useLensValue } from "@/hooks/useLensValue";
import {
  getIntegrations,
  pushNotification,
  saveIntegrations,
} from "@/lib/lensStore";
import type { IntegrationKey } from "@/lib/types";
import { defaultIntegrations } from "@/data/defaults";

const moduleIcon = "size-8 text-primary";

const MODULES: {
  key: IntegrationKey;
  name: string;
  icon: ReactNode;
  desc: string;
}[] = [
  {
    key: "mart",
    name: "MYHitch Mart Procurement",
    icon: <ShoppingCartIcon className={moduleIcon} />,
    desc: "Scan article texts and automatically display procurement product listings for logistics, hardware, or software components.",
  },
  {
    key: "services",
    name: "Scheduler & Consulting",
    icon: <BriefcaseIcon className={moduleIcon} />,
    desc: "Append appointment widgets enabling readers to book consultations or contracting opportunities directly with vetted authors.",
  },
  {
    key: "travel",
    name: "JetNRest SAF Bookings",
    icon: <SendIcon className={moduleIcon} />,
    desc: "Embed carbon-offset flight schedules and Sustainable Aviation Fuel (SAF) procurement options inside travel publications.",
  },
  {
    key: "donations",
    name: "Research Micro-grants",
    icon: <HeartIcon className={moduleIcon} />,
    desc: "Support academic and industry research by enabling micro-donation modules linked to web3 wallets.",
  },
  {
    key: "events",
    name: "Pass Event Summons",
    icon: <BookIcon className={moduleIcon} />,
    desc: "Inject ticket checkout elements for connected industry conferences, webinars, and vetting panels.",
  },
  {
    key: "videos",
    name: "Nexus Explainer Streams",
    icon: <FilmIcon className={moduleIcon} />,
    desc: "Embed short explainer videos or technical webinar broadcasts to supplement text summaries.",
  },
];

export default function IntegrationsPage() {
  const integrations = useLensValue(getIntegrations, defaultIntegrations);

  function toggleModule(key: IntegrationKey) {
    const current = getIntegrations();
    const next = { ...current, [key]: !current[key] };
    saveIntegrations(next);
    pushNotification(
      `Integration module '${key}' ${next[key] ? "enabled" : "disabled"}.`,
    );
  }

  return (
    <>
      <ViewHeader
        title="MYHitch Ecosystem Integrations"
        subtitle="Toggle API modules to dynamically append product widgets and actions into your reader's article views."
      />

      {/* Integrations Deck Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
        {MODULES.map((module) => {
          const isEnabled = integrations[module.key];
          return (
            /* `.category-card`, left-aligned variant */
            <div
              key={module.key}
              className="flex flex-col items-start gap-3 rounded-xl border border-line bg-bg-secondary p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-card max-[480px]:p-5"
            >
              <div className="mb-3 flex w-full items-center justify-between gap-3">
                <span className="inline-flex items-center justify-center">
                  {module.icon}
                </span>
                <Button
                  variant={isEnabled ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => toggleModule(module.key)}
                  className="gap-1"
                >
                  {isEnabled ? (
                    <>
                      <CheckIcon className="size-3 align-middle" strokeWidth={3} />{" "}
                      Connected
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
              <span className="mb-1.5 text-base font-bold">{module.name}</span>
              <p className="flex-1 text-xs leading-[1.5] text-text-muted">
                {module.desc}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
