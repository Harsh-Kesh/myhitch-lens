"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MobileMenu } from "@/components/layout/MobileMenu";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export const LANDING_NAV = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/workflow", label: "Workflow" },
  { href: "/functions", label: "Specs & Functions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * `.landing-header` - sticky, blurred top bar shared by every public page.
 * The active link is derived from the route instead of being hard-coded per
 * file as it was in the static build.
 */
export function LandingHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-100 flex h-[var(--header-h)] items-center justify-between gap-4 border-b border-line bg-[var(--header-bg)] px-10 transition-colors duration-300 [backdrop-filter:var(--glass-blur)] max-[1024px]:px-6 max-[640px]:px-4">
      <Link href="/" className="inline-flex cursor-pointer items-center gap-2.5 align-middle">
        <Image
          src="/images/logo.png"
          alt="MYHitch Lens"
          width={280}
          height={159}
          priority
          className="h-16 w-auto object-contain align-middle max-[1024px]:h-12 max-[640px]:h-10"
        />
      </Link>

      {/* Between 1024px and ~1200px the seven links plus the action cluster no
          longer clear the gutters, so both tighten before the drawer takes
          over at 1024px. */}
      <nav className="flex gap-8 max-[1280px]:gap-5 max-[1024px]:hidden">
        {LANDING_NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-[17px] font-semibold whitespace-nowrap transition-colors duration-200 max-[1280px]:text-[15px]",
                isActive ? "text-primary" : "text-text-muted hover:text-text-main",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-4 max-[1280px]:gap-2.5 max-[1024px]:hidden">
        <ButtonLink href="/auth?mode=signin" variant="secondary" className="whitespace-nowrap">
          Sign In
        </ButtonLink>
        <ButtonLink href="/auth?mode=signup" className="whitespace-nowrap">
          Launch App
        </ButtonLink>
      </div>

      <MobileMenu />
    </header>
  );
}
