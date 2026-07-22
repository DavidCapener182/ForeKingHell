import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ProductConfidence =
  | "High confidence"
  | "Moderate confidence"
  | "Low confidence"
  | "Estimated"
  | "Insufficient evidence";

export function ChartSurface({
  title,
  description,
  metadata,
  controls,
  confidence,
  children,
  dataTable,
  emptyState,
  footer,
  className,
  chartClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  controls?: ReactNode;
  confidence?: ProductConfidence;
  children?: ReactNode;
  dataTable?: ReactNode;
  emptyState?: ReactNode;
  footer?: ReactNode;
  className?: string;
  chartClassName?: string;
}) {
  return (
    <section
      data-chart-system="forekinghell"
      className={cn("flex h-full min-w-0 flex-col rounded-2xl border bg-card p-3", className)}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
          {metadata ? (
            <div className="mt-2 text-xs font-medium text-muted-foreground">{metadata}</div>
          ) : null}
        </div>
        {controls || confidence ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {confidence ? (
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold",
                  confidence === "High confidence"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : confidence === "Moderate confidence"
                      ? "border-chart-2/35 bg-chart-2/10 text-chart-2"
                      : "border-border bg-muted/55 text-muted-foreground",
                )}
              >
                {confidence}
              </span>
            ) : null}
            {controls}
          </div>
        ) : null}
      </div>
      {emptyState ?? (
        <div className={cn("chart-frame min-h-52 w-full", chartClassName)}>{children}</div>
      )}
      {footer ? <div className="mt-3">{footer}</div> : null}
      {dataTable ? <div className="mt-3 border-t border-border/70 pt-3">{dataTable}</div> : null}
    </section>
  );
}
