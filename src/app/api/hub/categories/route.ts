import { NextResponse } from "next/server";

import { listCategories } from "@/lib/articleCategory";
import { hubDenied } from "@/lib/hubAuth";
import { CONTENT_TYPES } from "@/lib/tagSuggestions";

/** GET /api/hub/categories - Lens's categories (to filter by and to file articles under) and article types. */
export async function GET(request: Request) {
  const denied = hubDenied(request);
  if (denied) return denied;
  try {
    const categories = await listCategories();
    return NextResponse.json({
      categories: categories.map((c) => ({ slug: c.slug, name: c.name, desc: c.desc })),
      types: CONTENT_TYPES,
    });
  } catch (e) {
    console.error("Lens hub categories:", e);
    return NextResponse.json({ error: "Could not load the categories." }, { status: 500 });
  }
}
