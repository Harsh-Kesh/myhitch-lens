import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { buttonClasses } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { activateFromCheckoutSession, BillingError } from "@/lib/billing";

/**
 * Where Stripe Checkout returns after payment. It activates the plan right away
 * by reading the completed session back from Stripe (the webhook is the backup
 * for everything later), then moves on to the billing page.
 */
export default async function BillingSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const { session_id: sessionId } = await searchParams;
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) redirect("/billing");

  let message: string | null = null;
  try {
    await activateFromCheckoutSession(sessionId, session.user.id);
  } catch (error) {
    message =
      error instanceof BillingError
        ? error.message
        : "We couldn't confirm your payment yet. If you were charged, your plan will appear shortly; contact support if it doesn't.";
    if (!(error instanceof BillingError)) console.error("[billing] activation failed", error);
  }
  if (!message) redirect("/billing?upgraded=1");

  return (
    <div className={dashCard}>
      <h3 className={dashHeading}>We&apos;re confirming your plan</h3>
      <p className="mb-4 text-[13px] text-text-muted">{message}</p>
      <Link href="/billing" className={buttonClasses("primary", "md")}>
        Go to Plan &amp; billing
      </Link>
    </div>
  );
}
