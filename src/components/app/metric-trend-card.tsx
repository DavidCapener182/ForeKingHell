import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MetricTrendPoint = { label: string; value: number };

export function MetricTrendCard({
  label,
  value,
  detail,
  delta,
  direction = "neutral",
  points = [],
  threshold,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  delta?: React.ReactNode;
  direction?: "up" | "down" | "neutral";
  points?: MetricTrendPoint[];
  threshold?: number;
  className?: string;
}) {
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const chart = buildSparkline(points, threshold);

  return (
    <Card className={cn("min-w-0 shadow-xs", className)} data-metric-trend-card>
      <CardContent className="grid min-h-36 gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</p>
          </div>
          {delta ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
              <Icon className="size-3.5" aria-hidden />
              {delta}
            </span>
          ) : null}
        </div>
        {chart ? (
          <svg
            viewBox="0 0 120 34"
            role="img"
            aria-label={`${label} trend from ${points[0]?.label} to ${points.at(-1)?.label}`}
            className="h-9 w-full overflow-visible"
            preserveAspectRatio="none"
          >
            {chart.thresholdY !== null ? (
              <line
                x1="0"
                x2="120"
                y1={chart.thresholdY}
                y2={chart.thresholdY}
                className="stroke-muted-foreground/35"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <polyline
              points={chart.points}
              fill="none"
              className="stroke-primary"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <p className="text-xs text-muted-foreground">Trend appears after two measured periods.</p>
        )}
        {detail ? <p className="text-xs leading-5 text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

function buildSparkline(points: MetricTrendPoint[], threshold?: number) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.value);
  if (typeof threshold === "number") values.push(threshold);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (index: number) => (index / (points.length - 1)) * 120;
  const y = (value: number) => 31 - ((value - min) / range) * 28;
  return {
    points: points.map((point, index) => `${x(index)},${y(point.value)}`).join(" "),
    thresholdY: typeof threshold === "number" ? y(threshold) : null,
  };
}
