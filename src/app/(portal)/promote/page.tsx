import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { buttonClasses } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { ADMIN_MODE_LABEL } from "@/lib/adminMode";
import { ROLE_HOME } from "@/lib/roleHome";

/**
 * Placeholder for the "Admin" dashboard, where a subscription package gets
 * promoted. Name and content are provisional. It is just a page: it does not
 * change the user's role or permissions.
 */
export default async function AdminModePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  return (
    <>
      <ViewHeader
        title={ADMIN_MODE_LABEL}
        subtitle="Promote your subscription package."
        actions={
          <Link href={ROLE_HOME[session.user.role]} className={buttonClasses("secondary", "sm")}>
            Switch back to Author
          </Link>
        }
      />

      <div className={dashCard}>
        <h3 className={dashHeading}>Subscription packages</h3>
        <p className="text-[13px] text-text-muted">
          Package promotion tools are coming soon. This dashboard&apos;s name and contents will change.
        </p>
      </div>
    </>
  );
}
