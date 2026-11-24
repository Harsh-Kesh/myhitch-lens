import { NextResponse } from "next/server";
import { nexboardDenied, reviewQueue } from "@/lib/nexboardReview";

export const dynamic = "force-dynamic";

/** Every published, public article for MYHitch NexBoard's checks (plan 13zj), rejected ones included. NEXBOARD_API_KEY. */
export async function GET(request: Request) {
  const denied = nexboardDenied(request);
  if (denied) return denied;
  return NextResponse.json({ data: await reviewQueue() }, { headers: { "cache-control": "no-store" } });
}
