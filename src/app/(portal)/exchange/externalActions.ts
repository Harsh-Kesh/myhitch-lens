"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/marketplace";

export type ActionResult = { error: string } | { ok: true };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") throw new Error("Not authorized");
  return session.user;
}

async function requireAuthor() {
  const session = await auth();
  if (!session?.user || session.user.role !== "author") throw new Error("Not authorized");
  return session.user;
}

/** Admin-only: post a brief from MYHitch Mart (or any other MYHitch product) for authors to pick up. */
export async function createExternalOpportunity(input: {
  platform: string;
  title: string;
  description: string;
  category?: string;
  expectedValue?: number | null;
}): Promise<ActionResult> {
  const admin = await requireAdmin();

  const platform = input.platform.trim();
  const title = input.title.trim();
  const description = input.description.trim();
  if (!platform) return { error: "Name the platform this opportunity is from." };
  if (!title) return { error: "Add a title." };
  if (!description) return { error: "Describe what the author would write." };

  await prisma.externalOpportunity.create({
    data: {
      platform,
      title,
      description,
      category: input.category?.trim() || null,
      expectedValue: input.expectedValue != null ? round2(Number(input.expectedValue)) : null,
      createdById: admin.id,
    },
  });

  revalidatePath("/exchange");
  return { ok: true };
}

/** Admin-only: take a listing down (kept for the record, not deleted). */
export async function deactivateExternalOpportunity(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.externalOpportunity.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/exchange");
  return { ok: true };
}

/**
 * Author-only: flag interest in an external brief. There's no live deal
 * pipeline for these yet (no real Mart integration to hand off to), so this
 * just puts the author in front of an admin to take the conversation from
 * there — same as how Exchange Hub submissions notify editors today.
 */
export async function expressInterest(id: string): Promise<ActionResult> {
  const user = await requireAuthor();

  const opportunity = await prisma.externalOpportunity.findUnique({ where: { id } });
  if (!opportunity || !opportunity.isActive) return { error: "This opportunity is no longer available." };

  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "external_opportunity_interest",
        text: `${user.name ?? "An author"} is interested in the ${opportunity.platform} opportunity "${opportunity.title}".`,
      })),
    });
  }

  return { ok: true };
}
