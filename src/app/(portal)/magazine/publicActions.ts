"use server";

import { getMagazinePlacement as getPlacement } from "@/lib/magazine";

/** Client-callable wrapper — src/lib/magazine.ts is server-only, not a server action. */
export async function getMagazinePlacement(articleId: string) {
  return getPlacement(articleId);
}
