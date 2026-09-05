"use client";

import { useState, type ComponentProps } from "react";

import { ClockIcon, ShieldIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import { ModerationQueue } from "../moderation/ModerationQueue";
import { EditorialAppealsQueue, type EditorialAppealRow } from "./EditorialAppealsQueue";

type ModerationProps = ComponentProps<typeof ModerationQueue>;

export function TrustSafetyHub({
  reports,
  appeals,
  editorialAppeals,
  categories,
}: {
  reports: ModerationProps["reports"];
  appeals: ModerationProps["appeals"];
  editorialAppeals: EditorialAppealRow[];
  categories: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<"moderation" | "appeals">("moderation");
  const openReportsAndAppeals = reports.length + appeals.length;

  return (
    <>
      <ViewHeader
        title="Trust & Safety"
        subtitle="Copyright moderation and editorial appeals, in one place. Author verification is now automatic — see each author's profile completeness instead."
      />

      <div className="mb-5 flex gap-1 border-b border-line">
        {(
          [
            ["moderation", "Copyright Moderation", ShieldIcon, openReportsAndAppeals],
            ["appeals", "Editorial Appeals", ClockIcon, editorialAppeals.length],
          ] as const
        ).map(([key, label, Icon, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-main",
            )}
          >
            <Icon className="size-4" />
            {label}
            {count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10.5px] font-bold",
                  tab === key ? "bg-primary-glow text-primary" : "bg-bg-tertiary text-text-muted",
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "moderation" && <ModerationQueue reports={reports} appeals={appeals} hideHeader />}
      {tab === "appeals" && <EditorialAppealsQueue appeals={editorialAppeals} categories={categories} />}
    </>
  );
}
