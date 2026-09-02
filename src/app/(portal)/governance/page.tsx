import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GovernanceCenter } from "./GovernanceCenter";

const EDITORIAL_REASONS = ["plagiarism", "category", "editorial", "other"];

/** Policy reference + the real appeals a reader/author has filed on their own articles. */
export default async function GovernancePage() {
  const session = await auth();
  if (!session?.user) return null;

  const [articles, appealRows] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: session.user.id },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.disputeTicket.findMany({
      where: { userId: session.user.id, reason: { in: EDITORIAL_REASONS } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const appeals = appealRows.map((r) => ({
    id: r.id,
    subject: r.subject,
    reason: r.reason,
    justify: r.justify,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  return <GovernanceCenter articles={articles.map((a) => ({ id: a.id, title: a.title || "Untitled" }))} appeals={appeals} />;
}
