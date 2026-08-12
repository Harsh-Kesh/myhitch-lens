import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

// Next.js 16 "proxy" convention (formerly middleware). Uses only the edge-safe
// base config (no Prisma) to gate portal routes via the `authorized` callback.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.png$).*)"],
};
