import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/AppSidebar";

/**
 * `.app-portal` - the fixed, full-viewport dashboard shell. Every signed-in
 * view renders inside this sidebar + workspace split.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-1000 flex h-screen overflow-hidden bg-bg-primary max-[768px]:relative max-[768px]:h-auto max-[768px]:flex-col max-[768px]:overflow-visible">
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto bg-bg-primary px-10 py-8 max-[1200px]:px-6 max-[768px]:h-auto max-[768px]:overflow-y-visible max-[768px]:p-5 max-[480px]:px-4 max-[480px]:py-5">
        {children}
      </main>
    </div>
  );
}
