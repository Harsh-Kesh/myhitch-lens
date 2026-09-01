"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { buttonClasses } from "@/components/ui/Button";
import {
  ArrowLeftIcon,
  BarChartIcon,
  BookIcon,
  CloseIcon,
  ColumnsIcon,
  DollarSignIcon,
  FolderIcon,
  MenuIcon,
  PencilIcon,
  PowerIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { useLensValue } from "@/hooks/useLensValue";
import { getQueue, getUserName, getUserRole, ROLE_NAMES } from "@/lib/lensStore";
import { logoutUser } from "@/app/auth/actions";
import { cn } from "@/lib/cn";
import { defaultQueue } from "@/data/defaults";
import type { UserRole } from "@/lib/types";

const navIcon = "size-4 shrink-0";

interface NavLink {
  href: string;
  label: string;
  icon: ReactNode;
  /** Roles allowed to see the link; omit for "everyone". */
  roles?: UserRole[];
  /** Renders the editorial queue counter badge. */
  showQueueCount?: boolean;
}

const NAV_LINKS: NavLink[] = [
  {
    href: "/reader-dashboard",
    label: "Reader Dashboard",
    icon: <UsersIcon className={navIcon} />,
    roles: ["reader"],
  },
  {
    href: "/author-dashboard",
    label: "Author Dashboard",
    icon: <UsersIcon className={navIcon} />,
    roles: ["author"],
  },
  { href: "/explore", label: "Explore Feed", icon: <BookIcon className={navIcon} /> },
  { href: "/categories", label: "Categories", icon: <FolderIcon className={navIcon} /> },
  {
    href: "/submit",
    label: "Submit Article",
    icon: <PencilIcon className={navIcon} />,
    roles: ["author", "editor", "admin"],
  },
  {
    href: "/editorial",
    label: "Editorial Queue",
    icon: <ColumnsIcon className={navIcon} />,
    roles: ["editor", "admin"],
    showQueueCount: true,
  },
  {
    href: "/verifications",
    label: "Verifications",
    icon: <ShieldIcon className={navIcon} />,
    roles: ["editor", "admin"],
  },
  {
    href: "/moderation",
    label: "Copyright Moderation",
    icon: <ShieldIcon className={navIcon} />,
    roles: ["editor", "admin"],
  },
  {
    href: "/magazine",
    label: "Magazine Curation",
    icon: <BookIcon className={navIcon} />,
    roles: ["editor", "admin"],
  },
  {
    href: "/panel",
    label: "Stakeholder Panel",
    icon: <DollarSignIcon className={navIcon} />,
  },
  {
    href: "/analytics",
    label: "Analytics Hub",
    icon: <BarChartIcon className={navIcon} />,
    roles: ["author", "editor", "admin"],
  },
  {
    href: "/governance",
    label: "Governance Center",
    icon: <ShieldIcon className={navIcon} />,
  },
  {
    href: "/integrations",
    label: "Integrations API",
    icon: <PowerIcon className={navIcon} />,
    roles: ["author", "editor", "admin"],
  },
];

const ROLE_PRESENTATION: Record<
  UserRole,
  { avatarChar: string; avatarBg: string; badge: string }
> = {
  reader: {
    avatarChar: "M",
    avatarBg: "linear-gradient(135deg, #74b9ff 0%, #0077b6 100%)",
    badge: "Reader Mode",
  },
  author: {
    avatarChar: "S",
    avatarBg: "linear-gradient(135deg, #2da4df 0%, #0056b3 100%)",
    badge: "Author (Vetted)",
  },
  editor: {
    avatarChar: "E",
    avatarBg: "linear-gradient(135deg, #0f2b5c 0%, #0077b6 100%)",
    badge: "Editor Portal",
  },
  admin: {
    avatarChar: "A",
    avatarBg: "linear-gradient(135deg, #1e293b 0%, #0f2b5c 100%)",
    badge: "Admin Console",
  },
};

/**
 * Everything below this width gets the off-canvas treatment. Phrased the way
 * Tailwind v4 compiles `max-[768px]:` - exclusive of the breakpoint - so the
 * JS and the CSS agree on which side of 768px we are on.
 */
const MOBILE_QUERY = "not all and (min-width: 768px)";

/**
 * `.app-sidebar` - a direct port of `injectSidebarMenu()`, which used to build
 * this markup as an HTML string on every page load. Role, name and queue count
 * are read from localStorage after mount so server and client render alike.
 *
 * On phones and small tablets the column slides in over the workspace instead
 * of stacking above it - nine nav links, the role simulator and the profile
 * widget would otherwise push every view a full screen down the page.
 */
export function AppSidebar() {
  const pathname = usePathname();

  const role = useLensValue(getUserRole, "author" as UserRole);
  const name = useLensValue(getUserName, ROLE_NAMES.author);
  const queue = useLensValue(getQueue, defaultQueue);
  const queueCount = queue.length;

  /**
   * Navigating dismisses the drawer; so does growing past the breakpoint, where
   * the column is permanently visible anyway. Storing the route the drawer was
   * opened on makes the first of those a derivation rather than a reset.
   */
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const isDrawerOpen = openedPath === pathname;

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const handleChange = () => {
      if (!query.matches) setOpenedPath(null);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  const presentation = ROLE_PRESENTATION[role];
  const visibleLinks = NAV_LINKS.filter(
    (link) => !link.roles || link.roles.includes(role),
  );

  return (
    <>
      {/* Mobile-only workspace bar. It owns the drawer toggle and keeps the
          brand reachable while the column is off-canvas. */}
      <div className="sticky top-0 z-40 hidden items-center justify-between gap-3 border-b border-line bg-bg-secondary px-4 py-3 max-[768px]:flex">
        <Link href="/explore" className="inline-flex items-center">
          <Image
            src="/images/logo.png"
            alt="MYHitch Lens"
            width={180}
            height={102}
            priority
            className="h-9 w-auto object-contain align-middle"
          />
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-[13px] font-semibold text-text-muted">
            {name}
          </span>
          <button
            type="button"
            onClick={() => setOpenedPath((open) => (open === pathname ? null : pathname))}
            aria-label={isDrawerOpen ? "Close workspace menu" : "Open workspace menu"}
            aria-expanded={isDrawerOpen}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-bg-tertiary p-2 text-text-main transition-all duration-200 hover:border-line-hover hover:bg-surface-hover"
          >
            {isDrawerOpen ? (
              <CloseIcon className="size-5" />
            ) : (
              <MenuIcon className="size-5" />
            )}
          </button>
        </div>
      </div>

      {/* Scrim */}
      <div
        onClick={() => setOpenedPath(null)}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 hidden bg-black/50 transition-opacity duration-300 max-[768px]:block",
          isDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-line bg-bg-secondary px-4 py-6",
          "max-[768px]:fixed max-[768px]:inset-y-0 max-[768px]:left-0 max-[768px]:z-50 max-[768px]:w-[min(300px,85vw)] max-[768px]:shadow-card max-[768px]:transition-transform max-[768px]:duration-300 max-[768px]:ease-[cubic-bezier(0.4,0,0.2,1)]",
          isDrawerOpen
            ? "max-[768px]:translate-x-0"
            : "max-[768px]:-translate-x-full",
        )}
      >
        <Link
          href="/explore"
          className="mb-5 flex cursor-pointer items-center justify-center border-b border-line px-4 pb-4"
        >
          <Image
            src="/images/logo.png"
            alt="MYHitch Lens"
            width={200}
            height={113}
            priority
            className="h-12 w-auto object-contain align-middle"
          />
        </Link>

        {/* `.user-profile-widget` */}
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-line bg-bg-primary p-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
            style={{ background: presentation.avatarBg }}
          >
            {presentation.avatarChar}
          </div>
          <div className="min-w-0">
            <h5 className="truncate font-heading text-[13.5px] font-semibold text-text-main">
              {name}
            </h5>
            <span className="text-[10px] font-bold text-primary uppercase">
              {presentation.badge}
            </span>
          </div>
        </div>

        {/* `.sidebar-nav` */}
        <nav className="flex flex-1 flex-col gap-1">
          {visibleLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "border-l-[3px] border-primary bg-primary-glow font-semibold text-text-main"
                    : "text-text-muted hover:bg-surface-hover hover:text-text-main",
                )}
              >
                {link.icon}
                <span>{link.label}</span>
                {link.showQueueCount && queueCount > 0 && (
                  <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">
                    {queueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* `.sidebar-footer` — account + navigation actions grouped at the bottom */}
        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
          <form action={logoutUser}>
            <button
              type="submit"
              className={buttonClasses("secondary", "md", "w-full")}
            >
              <PowerIcon className="size-3.5 align-middle" /> Log Out
            </button>
          </form>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium text-text-muted transition-colors hover:text-text-main"
          >
            <ArrowLeftIcon className="size-3.5 align-middle" /> Back to Landing
          </Link>
        </div>
      </aside>
    </>
  );
}
