"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  BillingError,
  createCheckoutUrl,
  createPortalUrl,
  freePlanSwitchEnabled,
  hasActivePaidPlan,
  isInterval,
  isPaidPlan,
  switchPlanWithoutPayment,
} from "@/lib/billing";
import { isPlanCode } from "@/lib/plans";

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

export type SwitchResult = { ok: true } | { error: string };

/**
 * TEST MODE: switch to a plan with no payment. Only works while the server has
 * ALLOW_FREE_PLAN_SWITCH=true (never on a live-Stripe deployment); the checks are
 * in switchPlanWithoutPayment, this just adds who is asking.
 */
export async function switchPlan(plan: string): Promise<SwitchResult> {
  const session = await auth();
  if (!session?.user) return { error: "Please sign in first." };
  if (session.user.role === "editor" || session.user.role === "admin") return { error: "Staff accounts don't need a plan." };
  if (!freePlanSwitchEnabled() || !isPlanCode(plan)) return { error: "Switching without payment isn't available." };

  try {
    await switchPlanWithoutPayment(session.user.id, plan);
  } catch (error) {
    if (error instanceof BillingError) return { error: error.message };
    console.error("[billing] free switch failed", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Couldn't switch your plan. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
