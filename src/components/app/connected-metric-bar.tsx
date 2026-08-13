import { cn } from "@/lib/utils";

export type ConnectedMetric = {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  trend?: React.ReactNode;
};

export function ConnectedMetricBar({
  metrics,
  label = "Current performance metrics",
  className,
}: {
  metrics: ConnectedMetric[];
  label?: string;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "grid overflow-hidden rounded-xl border bg-card shadow-xs sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
      data-connected-metric-bar
    >
      {metrics.slice(0, 4).map((metric, index) => (
        <div
          key={metric.label}
          className={cn(
            "min-w-0 p-4",
            index > 0 && "border-t sm:border-l sm:border-t-0",
            index === 2 && "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {metric.label}
            </p>
            {metric.trend ? (
              <span className="shrink-0 text-xs font-semibold">{metric.trend}</span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xl font-bold tracking-tight">{metric.value}</p>
          {metric.detail ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {metric.detail}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
