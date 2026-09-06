"use server";

import { lookupAbn, type AbnLookupResult } from "@/lib/abn";

/**
 * Live confirmation while someone finishes typing a complete ABN directly —
 * the same check already run at submit time, exposed here for instant
 * feedback instead of waiting for the form to be saved.
 */
export async function resolveAbn(abn: string): Promise<AbnLookupResult> {
  return lookupAbn(abn);
}
