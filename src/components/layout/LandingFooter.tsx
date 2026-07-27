"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  AppleIcon,
  CheckSquareIcon,
  FacebookIcon,
  GooglePlayIcon,
  InstagramIcon,
  LinkedInIcon,
  RedditIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** `.landing-footer` - four link columns, a socials/app strip and a legal bar. */

const FOOTER_COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "For Readers",
    links: [
      { href: "/explore", label: "How to read" },
      { href: "/explore", label: "Explore Feed" },
      { href: "/pricing", label: "Subscription Plans" },
      { href: "/categories", label: "Content Categories" },
      { href: "/explore", label: "Premium Access" },
      { href: "/reader-dashboard", label: "Bookmark Collections" },
      { href: "/reader-dashboard", label: "Vetted Creator Feeds" },
      { href: "/reader-dashboard", label: "Reader Dashboard" },
      { href: "/explore", label: "Community Discussions" },
      { href: "/explore", label: "Search Publications" },
    ],
  },
  {
    heading: "For Authors",
    links: [
      { href: "/about", label: "Vetting Requirements" },
      { href: "/author-dashboard", label: "Contributor Score Ranks" },
      { href: "/submit", label: "Submit an Article" },
      { href: "/submit", label: "Ingestion Word/PDF tool" },
      { href: "/submit", label: "AI Assistant Suite" },
      { href: "/author-dashboard", label: "Author Dashboard Portfolio" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "/contact", label: "Help & Support" },
      { href: "/about", label: "Success Stories" },
      { href: "/integrations", label: "Developer APIs" },
      { href: "/functions", label: "System Specifications" },
      { href: "/governance", label: "Governance bylaws" },
      { href: "/about", label: "Research Guidelines" },
      { href: "/governance", label: "Double-Blind Review Policy" },
      { href: "/governance", label: "Appeal Intakes Form" },
      { href: "/functions", label: "Release Notes" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/about", label: "Platform Mission" },
      { href: "/about", label: "Editorial Integrity Council" },
      { href: "/about", label: "Vetting Board members" },
      { href: "/about", label: "Careers" },
      { href: "/about", label: "Press Releases" },
      { href: "/contact", label: "Contact Us" },
      { href: "/about", label: "Partnerships" },
      { href: "/governance", label: "Trust, Safety & Security" },
    ],
  },
];

const SOCIALS: { label: string; icon: ReactNode }[] = [
  { label: "Facebook", icon: <FacebookIcon className="size-4" /> },
  { label: "LinkedIn", icon: <LinkedInIcon className="size-4" /> },
  { label: "X", icon: <XIcon className="size-4" /> },
  { label: "YouTube", icon: <YouTubeIcon className="size-4" /> },
  { label: "Instagram", icon: <InstagramIcon className="size-4" /> },
  { label: "Reddit", icon: <RedditIcon className="size-4" /> },
];

const LEGAL_LINKS = [
  "Terms of Service",
  "Privacy Policy",
  "CA Notice at Collection",
  "Your Privacy Choices",
  "Accessibility",
  "Sitemap",
];

/** `.social-icon-btn` */
const socialButton =
  "flex size-8 cursor-pointer items-center justify-center rounded-[50%] border border-line bg-transparent text-text-muted transition-all duration-200 hover:border-primary hover:bg-primary-glow hover:text-primary";

/** `.app-download-btn` */
const appButton =
  "flex cursor-pointer items-center justify-center rounded-md border border-line bg-transparent px-3 py-1.5 text-text-main transition-all duration-200 hover:border-primary hover:bg-primary-glow";

/** `.footer-bottom-links a` */
const legalLink =
  "text-text-muted no-underline transition-colors duration-200 hover:text-primary max-[1024px]:py-1.5";

/**
 * Two pages ended their content with a full-bleed section, so their footer sat
 * flush against it with no top border or gap. Preserved from the original
 * per-file inline overrides.
 */
const FLUSH_FOOTER_ROUTES = new Set(["/", "/features"]);

export function LandingFooter() {
  const pathname = usePathname();
  const isFlush = FLUSH_FOOTER_ROUTES.has(pathname);

  return (
    <footer
      className={cn(
        "bg-bg-primary pt-15 pb-[30px] font-body",
        isFlush ? "mt-0" : "mt-15 border-t border-line",
      )}
    >
      {/* Four columns of ten links each become a very long scroll once they
          stack, so the pairing is held until the labels genuinely stop fitting
          at ~400px. */}
      <div className="mx-auto grid max-w-[1100px] grid-cols-4 gap-[30px] px-5 max-[768px]:grid-cols-2 max-[768px]:gap-6 max-[400px]:grid-cols-1">
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.heading} className="flex flex-col gap-3">
            <h4 className="mb-1.5 font-heading text-[13.5px] font-bold text-text-main">
              {column.heading}
            </h4>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {column.links.map((link, index) => (
                <li key={`${link.href}-${index}`}>
                  {/* 12.5px type gives a 15px line box; the extra padding on
                      touch widths brings each row up to a 24px target. */}
                  <Link
                    href={link.href}
                    className="text-[12.5px] font-medium text-text-muted no-underline transition-colors duration-200 hover:text-primary max-[1024px]:inline-block max-[1024px]:py-1"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 flex max-w-[1100px] flex-wrap items-center justify-between gap-5 border-y border-line px-5 py-5 max-[768px]:flex-col max-[768px]:items-start">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-text-muted">Follow us</span>
          {SOCIALS.map((social) => (
            <button
              key={social.label}
              type="button"
              aria-label={social.label}
              onClick={() => alert(`${social.label} - Simulated`)}
              className={socialButton}
            >
              {social.icon}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-text-muted">Mobile app</span>
          <button
            type="button"
            onClick={() => alert("App Store - Simulated")}
            className={appButton}
          >
            <AppleIcon className="mr-1.5 size-4" />
            <span className="text-[11.5px] font-semibold">Apple Store</span>
          </button>
          <button
            type="button"
            onClick={() => alert("Google Play - Simulated")}
            className={appButton}
          >
            <GooglePlayIcon className="mr-1.5 size-4" />
            <span className="text-[11.5px] font-semibold">Google Play</span>
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4 px-5 pt-5 text-xs text-text-muted max-[768px]:flex-col max-[768px]:items-center max-[768px]:text-center">
        <span>&copy; 2015 - 2026 MYHitch&reg; Global LLC</span>
        <div className="flex flex-wrap gap-4">
          {LEGAL_LINKS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => alert(`${label} - Simulated`)}
              className={
                label === "Your Privacy Choices"
                  ? `${legalLink} inline-flex cursor-pointer items-center gap-1 bg-transparent`
                  : `${legalLink} cursor-pointer bg-transparent`
              }
            >
              {label}
              {label === "Your Privacy Choices" && (
                <CheckSquareIcon className="size-3.5 align-middle text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
