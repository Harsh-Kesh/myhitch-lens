/**
 * The "Admin" dashboard: a separate area (NOT the platform admin role) where a
 * user promotes a subscription package. Its name is a placeholder and will
 * change; the label and the route live here so renaming is a one-line edit.
 * The page is open to every signed-in user and grants no extra permissions.
 */
export const ADMIN_MODE_LABEL = "Admin";
export const ADMIN_MODE_PATH = "/promote";

/** Sidebar links shown while in Admin mode (every page under ADMIN_MODE_PATH). */
export const ADMIN_MODE_LINKS = [
  { href: ADMIN_MODE_PATH, label: `${ADMIN_MODE_LABEL} Home` },
  { href: `${ADMIN_MODE_PATH}/packages`, label: "Subscription Packages" },
  { href: `${ADMIN_MODE_PATH}/promotions`, label: "Promotions" },
] as const;

export function isAdminModePath(pathname: string): boolean {
  return pathname === ADMIN_MODE_PATH || pathname.startsWith(`${ADMIN_MODE_PATH}/`);
}
