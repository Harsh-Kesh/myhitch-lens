/**
 * Seeds the canonical 11 categories from the single source of truth
 * (`src/data/categories.ts`). Run with:  npx prisma db seed
 */
import { PrismaClient, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORIES } from "../src/data/categories";

const prisma = new PrismaClient();

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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
