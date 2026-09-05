import "server-only";

import { prisma } from "@/lib/prisma";

export interface ExternalOpportunityView {
  id: string;
  platform: string;
  title: string;
  description: string;
  category: string | null;
  expectedValue: number | null;
  isActive: boolean;
  createdAt: string;
}

function toView(row: {
  id: string;
  platform: string;
  title: string;
  description: string;
  category: string | null;
  expectedValue: unknown;
  isActive: boolean;
  createdAt: Date;
}): ExternalOpportunityView {
  return {
    id: row.id,
    platform: row.platform,
    title: row.title,
    description: row.description,
    category: row.category,
    expectedValue: row.expectedValue != null ? Number(row.expectedValue) : null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

/** What authors browsing the Exchange Hub see — active listings only. */
export async function listActiveExternalOpportunities(): Promise<ExternalOpportunityView[]> {
  const rows = await prisma.externalOpportunity.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toView);
}

/** Admin management view — active and deactivated listings alike. */
export async function listAllExternalOpportunities(): Promise<ExternalOpportunityView[]> {
  const rows = await prisma.externalOpportunity.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toView);
}
