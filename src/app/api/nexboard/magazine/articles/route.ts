import { badRequest, nexboardGet, okJson, parseIds, parseRange } from "@/lib/nexboardApi";
import { magazineArticles } from "@/lib/nexboardLens";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** The Lens articles a magazine issue can hold: published in the dates, plus `also` ids (lens_magazine_articles_v1). NEXBOARD_API_KEY. */
export async function GET(request: Request) {
  return nexboardGet(request, "magazine/articles", async (params) => {
    const range = parseRange(params);
    if (!range.ok) return badRequest(range.error);
    const also = parseIds(params.get("also"), "also", 0);
    if (!also.ok) return badRequest(also.error);
    const { data, meta } = await magazineArticles(prisma, range.value.from, range.value.to, also.value);
    return okJson("lens_magazine_articles_v1", data, { meta, range: range.value });
  });
}
