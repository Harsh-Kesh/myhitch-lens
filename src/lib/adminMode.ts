/**
 * The "Admin" dashboard: a separate area (NOT the platform admin role) where a
 * user promotes a subscription package. Its name is a placeholder and will
 * change; the label and the route live here so renaming is a one-line edit.
 * The page is open to every signed-in user and grants no extra permissions.
 */
export const ADMIN_MODE_LABEL = "Admin";
export const ADMIN_MODE_PATH = "/promote";

/**
 * Whether the user is currently in Admin mode is a UI preference kept in this
 * cookie. Nothing is authorised by it: every page and action still checks the
 * user's real role.
 */
export const ADMIN_MODE_COOKIE = "lens_mode";

/** Sidebar links for the Admin pages themselves. */
export const ADMIN_MODE_LINKS = [
  { href: ADMIN_MODE_PATH, label: `${ADMIN_MODE_LABEL} Home` },
  { href: `${ADMIN_MODE_PATH}/packages`, label: "Subscription Packages" },
  { href: `${ADMIN_MODE_PATH}/promotions`, label: "Promotions" },
] as const;

/**
 * Existing tools that Admin mode keeps in its menu, in the order of the Admin
 * Console. Only ones every author already has; the staff-only sections
 * (Editorial Queue, Trust & Safety, Magazine Curation, Integrations API) are
 * deliberately not here because they can change other people's content.
 */
export const ADMIN_MODE_SHARED_HREFS = ["/explore", "/categories", "/exchange", "/analytics", "/profile"] as const;
