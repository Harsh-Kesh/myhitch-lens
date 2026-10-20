import { NextResponse } from "next/server";

import { uploadAvatar } from "@/lib/hubDashboard";
import { hubError, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/profile/avatar - multipart `file` (JPEG/PNG/WEBP/GIF, up to 10 MB) -> { avatarUrl }. */
export async function POST(request: Request) {
  try {
    const ctx = await requireHubCompany(request);
    return NextResponse.json(await uploadAvatar(ctx, request));
  } catch (e) {
    return hubError(e);
  }
}
