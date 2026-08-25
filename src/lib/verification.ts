import "server-only";

import { prisma } from "@/lib/prisma";

export type VerificationState = "none" | "pending" | "approved" | "rejected";

export interface MyVerification {
  state: VerificationState;
  reviewerNote: string | null;
  organisation: string | null;
  links: string[];
}

/** The current user's verification status (for the author dashboard). */
export async function getMyVerification(userId: string): Promise<MyVerification> {
  const v = await prisma.authorVerification.findUnique({ where: { userId } });
  if (!v) return { state: "none", reviewerNote: null, organisation: null, links: [] };
  const cred = (v.credentials ?? {}) as { organisation?: string; links?: string[] };
  return {
    state: v.state as VerificationState,
    reviewerNote: v.reviewerNote,
    organisation: cred.organisation ?? null,
    links: cred.links ?? [],
  };
}

export interface VerificationRequestView {
  userId: string;
  name: string;
  role: string;
  createdAt: string;
  organisation: string | null;
  links: string[];
  domainMatch: boolean;
  articlesPublished: number;
}

/** Pending verification applications awaiting an editor's decision. */
export async function listVerificationQueue(): Promise<VerificationRequestView[]> {
  const rows = await prisma.authorVerification.findMany({
    where: { state: "pending" },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          role: true,
          _count: { select: { articles: true } },
        },
      },
    },
  });
  return rows.map((r) => {
    const cred = (r.credentials ?? {}) as { organisation?: string; links?: string[] };
    return {
      userId: r.userId,
      name: r.user.displayName,
      role: r.user.role,
      createdAt: r.createdAt.toISOString(),
      organisation: cred.organisation ?? null,
      links: cred.links ?? [],
      domainMatch: r.domainMatch,
      articlesPublished: r.user._count.articles,
    };
  });
}

/** Count of pending applications — for the sidebar badge. */
export async function pendingVerificationCount(): Promise<number> {
  return prisma.authorVerification.count({ where: { state: "pending" } });
}
