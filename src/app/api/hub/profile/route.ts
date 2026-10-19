import { NextResponse } from "next/server";

import { profile, updateMyProfile } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** GET /api/hub/profile - My Profile. */
export async function GET(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await profile(ctx));
  } catch (e) {
    return hubError(e);
  }
}

/** PATCH /api/hub/profile - { displayName, bio, website, country, abn }; returns the profile. Other fields are ignored. */
export async function PATCH(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    const body: unknown = await request.json().catch(() => ({}));
    return NextResponse.json(await updateMyProfile(ctx, body && typeof body === "object" ? (body as Record<string, unknown>) : {}));
  } catch (e) {
    return hubError(e);
  }
}
