import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Sessions are JWT-based and don't auto-refresh mid-session, so a role change
 * or suspension doesn't take effect until re-login. Money-moving and
 * submission actions re-check suspension against the DB directly rather than
 * trusting the token — the one thing that must never lag behind.
 */
export async function isSuspended(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { suspended: true } });
  return !!user?.suspended;
}
