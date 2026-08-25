import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { listVerificationQueue } from "@/lib/verification";
import { VerificationQueue } from "./VerificationQueue";

/** Editor/admin view: pending author-verification applications. */
export default async function VerificationsPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (!["editor", "admin"].includes(session.user.role)) redirect("/explore");

  const queue = await listVerificationQueue();
  return <VerificationQueue queue={queue} />;
}
