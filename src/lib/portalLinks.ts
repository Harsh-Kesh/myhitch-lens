/**
 * Link into the MYHitch Business portal to edit business details, then come
 * back to `path` (the Lens page the user was on) when they finish. The portal
 * validates `next` as a same-site Lens path; it can't choose another origin.
 */
export function portalManageHref(portalUrl: string, path: string): string {
  const url = new URL("/api/sso/lens/manage", portalUrl);
  url.searchParams.set("next", path || "/");
  return url.toString();
}

/**
 * A Lens-relative path that is safe to redirect to after sign-in: starts with a
 * single "/", only URL-safe characters, no "//" or backslashes or "..". Anything
 * else is rejected so a crafted link cannot send someone to another site.
 */
export function safeNextPath(raw: string | null | undefined): string | undefined {
  if (!raw || raw.length > 300) return undefined;
  if (!raw.startsWith("/") || raw.startsWith("//")) return undefined;
  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#[\]]*$/.test(raw)) return undefined;
  if (raw.includes("..") || raw.includes("\\")) return undefined;
  return raw;
}
