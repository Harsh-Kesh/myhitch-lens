import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { buttonClasses } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { ROLE_HOME } from "@/lib/roleHome";

/**
 * Shared placeholder for the pages of the "Admin" dashboard (a separate area,
 * NOT the platform admin role). Names and content are provisional.
 */
export async function AdminModePage({
  title,
  subtitle,
  heading,
  body,
}: {
  title: string;
  subtitle: string;
  heading: string;
  body: string;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  return (
    <>
      <ViewHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Link href={ROLE_HOME[session.user.role]} className={buttonClasses("secondary", "sm")}>
            Switch back to Author
          </Link>
        }
      />
      <div className={dashCard}>
        <h3 className={dashHeading}>{heading}</h3>
        <p className="text-[13px] text-text-muted">{body}</p>
      </div>
    </>
  );
}
