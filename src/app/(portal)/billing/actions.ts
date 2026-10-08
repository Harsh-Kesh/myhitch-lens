"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ownedOrganizationId } from "@/lib/entitlements";
import {
  BillingError,
  createCheckoutUrl,
  createPortalUrl,
  hasActivePaidPlan,
  isInterval,
  isPaidPlan,
} from "@/lib/billing";

export type CheckoutResult = { url: string } | { error: string } | { login: true };

/**
 * Start checkout for a paid plan. The plan and interval are validated against
 * the catalogue and the price is looked up on the server by its key, so nothing
 * the browser sends can change what is charged. Not signed in -> `login`, and the
 * pricing page sends the visitor through sign-in and resumes here.
 */
export async function startCheckout(plan: string, interval: string): Promise<CheckoutResult> {
  const session = await auth();
  if (!session?.user) return { login: true };
  if (session.user.role === "editor" || session.user.role === "admin") {
    return { error: "Staff accounts don't need a plan." };
  }
  if (!isPaidPlan(plan) || !isInterval(interval)) return { error: "Choose a valid plan." };

  try {
    // Lens Business is a company plan: it belongs to the company's owner.
    if (plan === "business" && !(await ownedOrganizationId(session.user.id))) {
      return { error: "Lens Business is for company accounts. Register your business with MYHitch first, then choose this plan." };
    }
    if (await hasActivePaidPlan(session.user.id)) {
      return { error: "You already have a paid plan. Use Manage billing to change or cancel it." };
    }
    return { url: await createCheckoutUrl(session.user.id, plan, interval) };
  } catch (error) {
    if (error instanceof BillingError) return { error: error.message };
    console.error("[billing] checkout failed", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Couldn't start checkout. Please try again shortly." };
  }
}

/** Open the Stripe Billing Portal (change plan, payment method, invoices, cancel). */
export async function openBillingPortal(): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  let url: string;
  try {
    url = await createPortalUrl(session.user.id);
  } catch (error) {
    console.error("[billing] portal failed", { error: error instanceof Error ? error.message : String(error) });
    redirect("/billing?error=portal");
  }
  redirect(url);
}
