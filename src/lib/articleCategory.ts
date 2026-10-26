import "server-only";

import { CATEGORIES } from "@/data/categories";
import { prisma } from "@/lib/prisma";

/**
 * Article categories and types, shared by the website's submit page and the
 * MYHitch app's company composer (through the hub).
 */

const TAG_CATEGORY_MAP: Record<string, string[]> = {
  "AI": ["artificial intelligence", "machine learning", "deep learning", "nlp", "llm", "neural network", "generative ai", "computer vision", "ai"],
  "Supply Chain": ["supply chain", "logistics", "warehousing", "fleet", "shipping", "freight", "procurement", "inventory"],
  "Technology": ["software", "hardware", "cloud", "devops", "cybersecurity", "blockchain", "iot", "api", "technology"],
  "Business": ["business", "strategy", "management", "startup", "entrepreneurship", "marketing", "leadership"],
  "Finance": ["finance", "fintech", "banking", "investment", "cryptocurrency", "trading", "economics"],
  "Healthcare": ["healthcare", "medical", "biotech", "pharma", "clinical", "telemedicine", "health"],
  "Education": ["education", "e-learning", "academic", "university", "training", "teaching"],
  "Travel": ["travel", "aviation", "tourism", "hospitality", "saf", "sustainable aviation"],
  "Lifestyle": ["lifestyle", "wellness", "remote work", "culture", "design", "creative"],
  "Research": ["research", "scientific", "laboratory", "academic paper", "methodology"],
  "Community": ["community", "governance", "discussion", "panel", "contributor"],
};

/** The category an article's tags point to (the website picks it this way on submit). */
export async function deriveCategoryFromTags(tagNames: string[]): Promise<string> {
  const lower = tagNames.map((t) => t.toLowerCase());
  let bestCategory = "Research";
  let bestScore = 0;

  for (const [categoryName, keywords] of Object.entries(TAG_CATEGORY_MAP)) {
    let score = 0;
    for (const tag of lower) {
      for (const keyword of keywords) {
        if (tag.includes(keyword) || keyword.includes(tag)) score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = categoryName;
    }
  }

  const category = await prisma.category.findFirst({ where: { name: bestCategory } });
  if (category) return category.id;
  const fallback = await prisma.category.findFirst();
  return fallback!.id;
}

/** Lens's categories as stored, in the platform's own order (src/data/categories.ts). */
export async function listCategories(): Promise<{ id: string; slug: string; name: string; desc: string }[]> {
  const rows = await prisma.category.findMany({ select: { id: true, slug: true, name: true, desc: true } });
  const order = (slug: string) => {
    const i = CATEGORIES.findIndex((c) => c.slug === slug);
    return i === -1 ? CATEGORIES.length : i;
  };
  return rows.sort((a, b) => order(a.slug) - order(b.slug) || a.name.localeCompare(b.name));
}

/** A category by its slug (or, failing that, its name), or null. */
export async function findCategory(value: string): Promise<{ id: string } | null> {
  const v = value.trim();
  if (!v || v.length > 80) return null;
  return prisma.category.findFirst({
    where: { OR: [{ slug: v.toLowerCase() }, { name: { equals: v, mode: "insensitive" } }] },
    select: { id: true },
  });
}
