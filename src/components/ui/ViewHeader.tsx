import type { ReactNode } from "react";

/** `.view-header` + `.view-title` + `.view-subtitle` */
export function ViewHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-[30px] flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5 max-[640px]:mb-6 max-[640px]:flex-col max-[640px]:items-stretch">
      <div className="min-w-0">
        <h2 className="mb-1 font-heading text-[26px] leading-[1.25] font-bold tracking-[-0.5px] text-text-main max-[640px]:text-[21px]">
          {title}
        </h2>
        <p className="text-[13.5px] text-text-muted">{subtitle}</p>
      </div>
      {actions}
    </div>
  );
}
