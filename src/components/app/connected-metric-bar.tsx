import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  embedded = false,
}: {
  metrics: ConnectedMetric[];
  label?: string;
  className?: string;
  embedded?: boolean;
}) {
  const visibleMetrics = metrics.slice(0, 4);

  const metricCells = visibleMetrics.map((metric, index) => (
    <div key={metric.label} className="relative grid min-w-0 content-start gap-1 px-4 py-4">
      {index > 0 ? <Separator className="absolute inset-x-4 top-0 w-auto sm:hidden" /> : null}
      {index > 0 ? (
        <Separator
          orientation="vertical"
          className={cn(
            "absolute inset-y-4 -left-px hidden h-auto",
            index % 2 === 1 && "sm:block",
            index > 0 && "xl:block",
          )}
        />
      ) : null}
      {index > 1 ? (
        <Separator className="absolute inset-x-4 top-0 hidden w-auto sm:block xl:hidden" />
      ) : null}
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
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{metric.detail}</p>
      ) : null}
    </div>
  ));

  const rootClassName = cn(
    "grid gap-0 overflow-hidden bg-card py-0 sm:grid-cols-2 xl:grid-cols-4",
    embedded ? "rounded-lg border border-border shadow-none" : "shadow-sm ring-border",
    className,
  );

  if (embedded) {
    return (
      <div
        role="region"
        aria-label={label}
        className={rootClassName}
        data-connected-metric-bar
        data-connected-metric-bar-embedded
      >
        {metricCells}
      </div>
    );
  }

  return (
    <Card role="region" aria-label={label} className={rootClassName} data-connected-metric-bar>
      {metricCells}
    </Card>
  );
}
