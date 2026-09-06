"use server";

import { lookupAbn, searchAbnByName, type AbnLookupResult, type AbnNameMatch } from "@/lib/abn";

/**
 * Live candidates while someone types a business name into the ABN field.
 * Public government registry data, read-only — no auth required to call it.
 */
export async function searchAbnCandidates(query: string): Promise<AbnNameMatch[]> {
  return searchAbnByName(query);
}

/**
 * Live confirmation while someone finishes typing a complete ABN directly —
 * the same check already run at submit time, exposed here for instant
 * feedback instead of waiting for the form to be saved.
 */
export async function resolveAbn(abn: string): Promise<AbnLookupResult> {
  return lookupAbn(abn);
}
