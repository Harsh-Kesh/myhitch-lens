import type { ReactNode } from "react";

/** `.feature-card` + `.feature-icon-wrapper` + `.feature-name` + `.feature-text` */
export function FeatureCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-secondary p-8 transition-all duration-300 hover:-translate-y-1.5 hover:border-line-hover hover:shadow-card max-[480px]:p-6">
      <div className="mb-5 flex size-12 items-center justify-center rounded-[10px] bg-primary-glow text-primary">
        {icon}
      </div>
      <h3 className="mb-2.5 font-heading text-lg leading-[1.25] font-bold text-text-main">{title}</h3>
      <p className="text-[13.5px] leading-[1.6] text-text-muted">{children}</p>
    </div>
  );
}

/** `.features-grid` */
export const featuresGrid =
  "grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-[30px] max-[480px]:gap-5";
