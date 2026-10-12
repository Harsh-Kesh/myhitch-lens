import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const HINTABLE_ROLES = new Set(["author", "corporate"]);

/**
 * Legacy entry point. Every old link and bookmark to `/auth` (and
 * `/auth?mode=signup&role=…`) now lands on the portal SSO launcher. Only the two
 * known UI hints are carried over; nothing else is forwarded.
 */
export default async function AuthPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const out = new URLSearchParams();
  if (params.mode === "signup") out.set("mode", "signup");
  if (typeof params.role === "string" && HINTABLE_ROLES.has(params.role)) out.set("role", params.role);
  const query = out.toString();
  redirect(query ? `/auth/login?${query}` : "/auth/login");
}
