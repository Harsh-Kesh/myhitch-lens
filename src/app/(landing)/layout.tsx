import type { ReactNode } from "react";

import { LandingFooter } from "@/components/layout/LandingFooter";
import { LandingHeader } from "@/components/layout/LandingHeader";

/** Shared chrome for every public marketing page. */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LandingHeader />
      {children}
      <LandingFooter />
    </>
  );
}
