import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";

import { StoreProvider } from "@/components/providers/StoreProvider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MYHitch Lens - Trusted Knowledge. Verified Voices.",
  description:
    "MYHitch Lens Platform - Trusted Knowledge, Verified Voices. An advanced article sharing, editorial review, and analytics platform powered by AI.",
};

/**
 * `maximumScale` and `userScalable` are deliberately left at their defaults so
 * pinch-to-zoom keeps working; only the initial scale is pinned.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
