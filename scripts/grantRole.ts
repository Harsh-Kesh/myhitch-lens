/**
 * Promote (or demote) a Lens account to a platform role. The ONLY way editor /
 * admin roles are granted: portal SSO never assigns them and the browser can't
 * ask for them.
 *
 *   npx tsx scripts/grantRole.ts <email> <editor|admin|reader> [--dry-run]
 *
 * The person must already have signed in once through the MYHitch Business
 * portal (so a PlatformIdentity exists and the email is verified). Company
 * accounts are refused: their role is managed by their company membership.
 * The new role applies at their next sign-in (sessions are JWTs).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ALLOWED = new Set(["editor", "admin", "reader"]);

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [rawEmail, role] = args.filter((a) => !a.startsWith("--"));

  if (!rawEmail || !role || !ALLOWED.has(role)) {
    console.error("Usage: npx tsx scripts/grantRole.ts <email> <editor|admin|reader> [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const email = rawEmail.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      displayName: true,
      platformIdentity: { select: { id: true } },
      memberships: { select: { id: true }, take: 1 },
    },
  });

  if (!user) {
    console.error(`No Lens user with email ${email}. They must sign in through MYHitch first.`);
    process.exitCode = 1;
    return;
  }
  if (!user.platformIdentity) {
    console.error(`${email} has never signed in through the portal (no linked identity). Refusing.`);
    process.exitCode = 1;
    return;
  }
  if (user.memberships.length > 0) {
    console.error(`${email} belongs to a company; company roles are managed by the company. Refusing.`);
    process.exitCode = 1;
    return;
  }
  if (user.role === role) {
    console.log(`${email} (${user.displayName}) is already ${role}. Nothing to do.`);
    return;
  }

  console.log(`${email} (${user.displayName}): ${user.role} -> ${role}${dryRun ? "  [dry run, nothing written]" : ""}`);
  if (dryRun) return;

  await prisma.user.update({ where: { id: user.id }, data: { role: role as "editor" | "admin" | "reader" } });
  console.log("Done. It takes effect the next time they sign in.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
