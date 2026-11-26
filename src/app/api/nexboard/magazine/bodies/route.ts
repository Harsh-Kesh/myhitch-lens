import { badRequest, nexboardGet, okJson, parseIds } from "@/lib/nexboardApi";
import { magazineBodies } from "@/lib/nexboardLens";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** The full text of chosen articles, for laying out magazine pages (lens_magazine_bodies_v1). NEXBOARD_API_KEY. */
export async function GET(request: Request) {
  return nexboardGet(request, "magazine/bodies", async (params) => {
    const ids = parseIds(params.get("ids"), "ids", 1);
    if (!ids.ok) return badRequest(ids.error);
    return okJson("lens_magazine_bodies_v1", await magazineBodies(prisma, ids.value));
  });
}
