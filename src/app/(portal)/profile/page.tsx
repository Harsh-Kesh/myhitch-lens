import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getConnectStatus } from "@/app/(portal)/author-dashboard/payoutActions";
import { ProfileSettings } from "./ProfileSettings";

/** Account settings — open to every signed-in role. */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      displayName: true,
      email: true,
      username: true,
      profile: { select: { bio: true, website: true, country: true, abn: true } },
    },
  });
  if (!user) redirect("/auth");

  const connectStatus = session.user.role === "author" ? await getConnectStatus(session.user.id) : null;

  return (
    <ProfileSettings
      displayName={user.displayName}
      email={user.email}
      username={user.username}
      bio={user.profile?.bio ?? ""}
      website={user.profile?.website ?? ""}
      country={user.profile?.country ?? ""}
      abn={user.profile?.abn ?? ""}
      connectStatus={connectStatus}
    />
  );
}
