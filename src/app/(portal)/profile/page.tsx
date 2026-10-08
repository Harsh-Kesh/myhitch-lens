import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getConnectStatus } from "@/app/(portal)/author-dashboard/payoutActions";
import { getEntitlements } from "@/lib/entitlements";
import { ProfileSettings } from "./ProfileSettings";

/** Account settings — open to every signed-in role. */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      displayName: true,
      email: true,
      username: true,
      profile: { select: { bio: true, website: true, country: true, abn: true, avatarUrl: true } },
    },
  });
  if (!user) redirect("/auth/login");

  // Payouts belong to monetisation (Professional and above); Free sees a locked note instead.
  const canMonetise = session.user.role !== "author" || (await getEntitlements(session.user.id)).monetisation;
  const connectStatus = session.user.role === "author" && canMonetise ? await getConnectStatus() : null;
  const payoutsLocked = session.user.role === "author" && !canMonetise;

  return (
    <ProfileSettings
      displayName={user.displayName}
      email={user.email}
      username={user.username}
      bio={user.profile?.bio ?? ""}
      website={user.profile?.website ?? ""}
      country={user.profile?.country ?? ""}
      abn={user.profile?.abn ?? ""}
      avatarUrl={user.profile?.avatarUrl ?? null}
      connectStatus={connectStatus}
      payoutsLocked={payoutsLocked}
    />
  );
}
