import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ROLE_HOME } from "@/lib/roleHome";

/** Post-SSO landing: sends the freshly signed-in user to their role's home. */
export default async function AuthLandingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  redirect(ROLE_HOME[session.user.role] ?? "/explore");
}
