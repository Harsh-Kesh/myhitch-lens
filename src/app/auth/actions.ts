"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";

import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export type AuthResult = { error: string } | undefined;

/** Where each role lands after authenticating. */
const ROLE_HOME: Record<UserRole, string> = {
  reader: "/reader-dashboard",
  author: "/author-dashboard",
  editor: "/editorial",
  corporate: "/author-dashboard",
  admin: "/editorial",
};

function parseRole(value: unknown): UserRole {
  return value === "reader" || value === "author" || value === "editor"
    ? value
    : "reader";
}

export async function registerUser(input: {
  username: string;
  email: string;
  password: string;
  role: string;
}): Promise<AuthResult> {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const role = parseRole(input.role);

  if (!username || !email || !password) {
    return { error: "Please fill in username, email, and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    return { error: "That username or email is already registered." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const displayName = input.username.trim();

  // Create the account plus its profile, wallet, and starting rank together.
  await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role,
      displayName,
      profile: { create: {} },
      wallet: { create: {} },
      rank: { create: {} },
    },
  });

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: ROLE_HOME[role],
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Could not sign you in." };
    throw error; // redirect
  }
}

export async function loginUser(input: {
  username: string;
  password: string;
}): Promise<AuthResult> {
  const username = input.username.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { username } });
  const redirectTo = user ? ROLE_HOME[user.role] : "/explore";

  try {
    await signIn("credentials", {
      username,
      password: input.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid username or password." };
    }
    throw error; // redirect
  }
}

export async function logoutUser(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

/** Current authenticated user's role + display name, or null. */
export async function currentSession() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name ?? "",
  };
}
