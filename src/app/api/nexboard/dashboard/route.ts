import { badRequest, nexboardGet, okJson, parsePeriod } from "@/lib/nexboardApi";
import { lensDashboard } from "@/lib/nexboardLens";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Everything on NexBoard's Lens dashboard pages for a period and the one before it (lens_dashboard_v1). NEXBOARD_API_KEY. */
export async function GET(request: Request) {
  return nexboardGet(request, "dashboard", async (params) => {
    const period = parsePeriod(params);
    if (!period.ok) return badRequest(period.error);
    return okJson("lens_dashboard_v1", await lensDashboard(prisma, period.value), { range: period.value });
  });
}
