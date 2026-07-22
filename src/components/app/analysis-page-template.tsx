import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AnalysisPageTemplate({
  answer,
  dataWarning,
  recommendation,
  children,
  className,
}: {
  answer: ReactNode;
  dataWarning?: ReactNode;
  recommendation?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-6", className)} data-analysis-page-template>
      <section
        aria-label="Answer and evidence quality"
        className={cn(
          "grid gap-4",
          dataWarning && "lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]",
        )}
      >
        {answer}
        {dataWarning}
      </section>
      {recommendation}
      {children}
    </div>
  );
}
