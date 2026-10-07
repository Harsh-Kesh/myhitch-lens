import { NextResponse } from "next/server";

import { hubDenied, issueHubToken } from "@/lib/hubAuth";
import { hubError, openHubSession } from "@/lib/hubCompany";

/**
 * POST /api/hub/session - the MYHitch hub signs a business in to its Lens
 * company account (made the first time). The hub has already checked with
 * the MYHitch Business Portal that the business is approved and picked Lens.
 */
export async function POST(request: Request) {
  const denied = hubDenied(request);
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = await openHubSession({
      myhitchId: String(body.myhitchId ?? ""),
      email: String(body.email ?? ""),
      name: String(body.name ?? ""),
      businessName: String(body.businessName ?? ""),
      abn: body.abn ? String(body.abn) : undefined,
    });
    return NextResponse.json(issueHubToken(userId));
  } catch (e) {
    return hubError(e);
  }
}
