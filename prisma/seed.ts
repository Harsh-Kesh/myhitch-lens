/**
 * Seeds the canonical 11 categories from the single source of truth
 * (`src/data/categories.ts`). Run with:  npx prisma db seed
 */
import { PrismaClient, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORIES } from "../src/data/categories";
import { defaultArticles, defaultQueue } from "../src/data/defaults";

const prisma = new PrismaClient();

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const usernameFrom = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Ensure a user row exists for an article author, return its id. */
async function ensureAuthor(displayName: string): Promise<string> {
  const username = usernameFrom(displayName);
  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      email: `${username}@lens.demo`,
      role: "author",
      displayName,
      profile: { create: {} },
      wallet: { create: {} },
      rank: { create: {} },
    },
  });
  return user.id;
}

/** Demo accounts so the platform is usable immediately (real, hashed passwords). */
const DEMO_USERS: {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  displayName: string;
}[] = [
  { username: "markus_green", email: "markus@lens.demo", password: "password99", role: "reader", displayName: "Markus Green" },
  { username: "sarah_chen", email: "sarah@lens.demo", password: "password123", role: "author", displayName: "Dr. Sarah Chen" },
  { username: "editor_vance", email: "vance@lens.demo", password: "boss_editor", role: "editor", displayName: "Chief Editor Vance" },
];

async function main() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, desc: category.desc },
      create: { name: category.name, slug: category.slug, desc: category.desc },
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);

  for (const demo of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(demo.password, 10);
    await prisma.user.upsert({
      where: { username: demo.username },
      update: {},
      create: {
        username: demo.username,
        email: demo.email,
        passwordHash,
        role: demo.role,
        displayName: demo.displayName,
        profile: { create: {} },
        wallet: { create: {} },
        rank: { create: demo.role === "author" ? { tier: "gold", points: 4200 } : {} },
      },
    });
  }
  console.log(`Seeded ${DEMO_USERS.length} demo users.`);

  // --- Articles (same art-N ids as the localStorage defaults) ---
  const categoryBySlug = new Map(
    (await prisma.category.findMany()).map((c) => [c.slug, c.id]),
  );

  for (const article of defaultArticles) {
    const authorId = await ensureAuthor(article.author);
    const categoryId = categoryBySlug.get(slugify(article.category));
    if (!categoryId) {
      console.warn(`  skipped ${article.id}: unknown category ${article.category}`);
      continue;
    }
    const words = article.content.trim().split(/\s+/).length;
    const readTimeMin = parseInt(article.readTime, 10) || Math.max(1, Math.ceil(words / 150));
    await prisma.article.upsert({
      where: { id: article.id },
      update: { aiScores: { readTimeMin } },
      create: {
        id: article.id,
        slug: slugify(article.title),
        title: article.title,
        summary: article.summary,
        content: article.content,
        contentType: article.type,
        status: "published",
        lane: "public",
        verified: article.verified,
        authorId,
        categoryId,
        likesCount: article.likes,
        viewsCount: article.likes * 12,
        aiScores: { readTimeMin },
        publishedAt: new Date(`${article.date}T09:00:00Z`),
      },
    });
  }
  console.log(`Seeded ${defaultArticles.length} articles.`);

  // --- Editorial queue submissions (status = in_review, same rev-N ids) ---
  const fallbackCategoryId = categoryBySlug.get("research")!;
  for (const item of defaultQueue) {
    const authorId = await ensureAuthor(item.author);
    const categoryId = categoryBySlug.get(slugify(item.category)) ?? fallbackCategoryId;
    const words = item.content.trim().split(/\s+/).length;
    await prisma.article.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        slug: slugify(item.title),
        title: item.title,
        summary: `${item.content.slice(0, 140)}…`,
        content: item.content,
        contentType: item.type,
        status: "in_review",
        lane: "public",
        authorId,
        categoryId,
        aiScores: {
          readTimeMin: Math.max(1, Math.ceil(words / 150)),
          aiScore: item.aiScore,
          plagiarism: item.plagiarism,
          readability: item.readability,
          sentiment: item.sentiment,
        },
      },
    });
  }
  console.log(`Seeded ${defaultQueue.length} review-queue submissions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
