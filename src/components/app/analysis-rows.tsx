import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SessionSummary({
  title,
  meta,
  insight,
  metrics,
  action,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  insight?: ReactNode;
  metrics?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{title}</h3>
          {meta ? <p className="mt-0.5 text-sm text-muted-foreground">{meta}</p> : null}
        </div>
        {action}
      </div>
      {insight ? <p className="mt-3 text-sm leading-6">{insight}</p> : null}
      {metrics ? <div className="mt-3">{metrics}</div> : null}
    </article>
  );
}

export function ClubRow({
  club,
  primaryMetric,
  supportingMetric,
  status,
  action,
  className,
}: {
  club: ReactNode;
  primaryMetric: ReactNode;
  supportingMetric?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">{club}</p>
        {supportingMetric ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{supportingMetric}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-semibold tabular-nums">{primaryMetric}</p>
          {status ? <div className="mt-1">{status}</div> : null}
        </div>
        {action}
      </div>
    </div>
  );
}
