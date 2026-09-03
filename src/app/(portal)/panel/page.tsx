import Link from "next/link";

import { auth } from "@/auth";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { Button } from "@/components/ui/Button";
import { dashCard } from "@/components/ui/DashboardKit";

/**
 * Retired: buying and selling article ownership no longer happens inside
 * Lens. Sponsorship via the Exchange Hub is now the only revenue path for
 * authors. The underlying marketplace code (actions.ts, PanelMarketplace.tsx,
 * src/lib/marketplace.ts) is left in place, dormant, rather than deleted.
 */
export default async function PanelPage() {
  const session = await auth();
  if (!session?.user) return null;
  const isAuthor = session.user.role === "author";

  return (
    <>
      <ViewHeader
        title="Ownership Marketplace"
        subtitle="This feature has been retired — buying and selling article ownership no longer happens inside Lens."
      />
      <div className={dashCard}>
        <p className="p-8 text-center text-[13.5px] text-text-muted">
          {isAuthor
            ? "The Exchange Hub is now the only way to earn revenue from your articles — submit an unpublished article there to line up a sponsor before it goes live."
            : "Acquiring commercial rights to an article now happens through MYHitch's Exchange Hub, not inside Lens."}
        </p>
        {isAuthor && (
          <div className="flex justify-center pb-6">
            <Link href="/exchange">
              <Button size="sm">Go to Exchange Hub</Button>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
