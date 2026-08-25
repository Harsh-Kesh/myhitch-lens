import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ModerationQueue } from "./ModerationQueue";

/** Editor/admin: copyright reports awaiting a takedown decision. */
export default async function ModerationPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (!["editor", "admin"].includes(session.user.role)) redirect("/explore");

  const rows = await prisma.disputeTicket.findMany({
    where: { reason: "copyright", status: { in: ["open", "under_review"] } },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { displayName: true } } },
  });

  const reports = rows.map((r) => {
    const [articleId, ...rest] = r.subject.split(" — ");
    return {
      id: r.id,
      articleId: articleId.trim(),
      articleTitle: rest.join(" — ") || "(unknown)",
      reporter: r.user.displayName,
      details: r.justify,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return <ModerationQueue reports={reports} />;
}
