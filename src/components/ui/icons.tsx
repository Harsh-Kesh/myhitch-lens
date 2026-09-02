import type { SVGProps } from "react";

/**
 * Every inline SVG from the original markup, collected in one place.
 * Stroke icons inherit `currentColor`; sizing is left to the caller so the
 * exact per-usage dimensions from the source pages are preserved.
 */

type IconProps = SVGProps<SVGSVGElement>;

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const solid = {
  viewBox: "0 0 24 24",
  fill: "currentColor",
} as const;

/* --- Navigation / chrome --- */
export const MenuIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export const AlertTriangleIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/* --- Platform capabilities --- */
export const UsersIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const CreditCardIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

export const PencilIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const ColumnsIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="17" y1="3" x2="17" y2="21" />
  </svg>
);

export const FolderIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const ActivityIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

export const CpuIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
  </svg>
);

export const BookIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

export const BarChartIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

export const ShieldIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const PowerIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

/* --- Inline article chrome --- */
export const CheckIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const CheckSquareIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <polyline points="9 11 12 14 22 4" />
  </svg>
);

export const HeartIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const BookmarkIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

export const UploadCloudIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    <polyline points="16 16 12 12 8 16" />
  </svg>
);

export const SparklesIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M12 3l1.9 5.8L20 10.7l-5.1 3.7L16 21l-4-3.2L8 21l1.1-6.6L4 10.7l6.1-1.9z" />
  </svg>
);

export const UsersGroupIcon = (p: IconProps) => (
  <svg {...stroke} strokeLinecap={undefined} strokeLinejoin={undefined} {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const EditSquareIcon = (p: IconProps) => (
  <svg {...stroke} strokeLinecap={undefined} strokeLinejoin={undefined} {...p}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const PackageIcon = (p: IconProps) => (
  <svg {...stroke} strokeLinecap={undefined} strokeLinejoin={undefined} {...p}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

export const CheckCircleIcon = (p: IconProps) => (
  <svg {...stroke} strokeLinecap={undefined} strokeLinejoin={undefined} {...p}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const DollarSignIcon = (p: IconProps) => (
  <svg {...stroke} strokeLinecap={undefined} strokeLinejoin={undefined} {...p}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

export const MapPinIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const MailIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

export const ShoppingCartIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

/* --- Editor toolbar + AI assistant --- */
export const LinkIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export const ListIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

export const ImageIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

export const MusicIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export const FileTextIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const GlobeIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const MicIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

export const UploadIcon = (p: IconProps) => (
  <svg {...stroke} strokeLinecap={undefined} strokeLinejoin={undefined} {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export const StarBurstIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path
      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
      fill="currentColor"
    />
  </svg>
);

export const CalendarIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const FilmIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="22" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
  </svg>
);

export const KeyIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="M21 2l-2 2m-7.61 7.61L15.5 7.5m0 0L19 11l3-3-3-3-3.5 3.5" />
  </svg>
);

/* --- Category taxonomy --- */
export const BriefcaseIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

export const BoxesIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <polygon points="12 22.08 12 12 3 6.81 3 16.92 12 22.08" />
    <polygon points="12 22.08 21 16.92 21 6.81 12 12 12 22.08" />
    <polygon points="12 12 21 6.81 12 1.58 3 6.81 12 12" />
  </svg>
);

export const MonitorIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export const PulseIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

export const GraduationCapIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c0 2 2.5 3 6 3s6-1 6-3v-5" />
  </svg>
);

export const SendIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);

export const CoffeeIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
);

export const SearchCircleIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M10 22c5.523 0 10-4.477 10-10S15.523 2 10 2 0 6.477 0 12s4.477 10 10 10z" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <circle cx="10" cy="12" r="3" />
  </svg>
);

/* --- Social / store badges (solid) --- */
export const FacebookIcon = (p: IconProps) => (
  <svg {...solid} {...p}>
    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
  </svg>
);

export const LinkedInIcon = (p: IconProps) => (
  <svg {...solid} {...p}>
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

export const XIcon = (p: IconProps) => (
  <svg {...solid} {...p}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const YouTubeIcon = (p: IconProps) => (
  <svg {...solid} {...p}>
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.388.51a3.003 3.003 0 0 0-2.11 2.108C0 8.025 0 12 0 12s0 3.975.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.863.51 9.388.51 9.388.51s7.524 0 9.388-.51a3.003 3.003 0 0 0 2.11-2.108c.502-1.862.502-5.837.502-5.837s0-3.975-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const InstagramIcon = (p: IconProps) => (
  <svg {...solid} {...p}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
  </svg>
);

export const RedditIcon = (p: IconProps) => (
  <svg {...solid} {...p}>
    <path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.85-1.64-6.29-1.72l1.35-4.24 3.71.79c.04.97.85 1.73 1.85 1.73 1.02 0 1.85-.83 1.85-1.85S20.41 2.8 19.39 2.8c-.85 0-1.57.58-1.78 1.36l-4.11-.88c-.27-.06-.54.1-.63.36l-1.53 4.81c-2.49.07-4.74.72-6.4 1.73-.57-.76-1.47-1.24-2.42-1.24-1.65 0-3 1.35-3 3 0 1.12.61 2.1 1.53 2.62-.06.29-.09.59-.09.9 0 3.99 4.9 7.24 10.95 7.24 6.04 0 10.95-3.25 10.95-7.24 0-.31-.03-.61-.09-.9.92-.52 1.53-1.5 1.53-2.62zm-18.49 1a1.42 1.42 0 0 1 1.42-1.42c.79 0 1.42.64 1.42 1.42 0 .79-.64 1.42-1.42 1.42a1.42 1.42 0 0 1-1.42-1.42zm11.58 5.64c-1.33 1.33-3.85 1.43-4.59 1.43-.75 0-3.27-.1-4.59-1.43-.19-.19-.19-.51 0-.7.19-.19.51-.19.7 0 .99.99 3.01 1.13 3.89 1.13.88 0 2.9-.14 3.89-1.13.19-.19.51-.19.7 0 .2.19.2.51 0 .7zm-.62-4.22c-.79 0-1.42-.64-1.42-1.42 0-.79.64-1.42 1.42-1.42.79 0 1.42.64 1.42 1.42 0 .79-.63 1.42-1.42 1.42z" />
  </svg>
);

export const AppleIcon = (p: IconProps) => (
  <svg {...solid} {...p}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z" />
  </svg>
);

export const GooglePlayIcon = (p: IconProps) => (
  <svg {...solid} {...p}>
    <path d="M3.609 1.814L13.78 12 3.609 22.186A2.244 2.244 0 0 1 3 20.556V3.444c0-.665.228-1.265.609-1.63zM14.97 13.19l3.064 3.065L4.858 21.68c.518.256 1.132.228 1.637-.1L18.034 16.26l-3.065-3.07zm4.316-2.437l3.085 1.758a1.085 1.085 0 0 1 0 1.902l-3.085 1.758-3.065-3.064 3.065-3.065zM4.858 2.32l13.176 7.502 3.065-3.065L6.495.42c-.505-.328-1.12-.356-1.637-.1z" />
  </svg>
);
