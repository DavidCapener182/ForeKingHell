"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Line, LineChart, ReferenceLine } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type MetricTrendPoint = { label: string; value: number };

const chartConfig = {
  value: {
    label: "Measured value",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

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

  return (
    <Card
      className={cn(
        "min-w-0 bg-gradient-to-br from-card via-card to-primary/[0.035] shadow-sm ring-border",
        className,
      )}
      data-metric-trend-card
    >
      <CardContent className="grid min-h-36 gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</p>
          </div>
          {delta ? (
            <Badge
              variant={direction === "neutral" ? "outline" : "secondary"}
              className="shrink-0 gap-1 shadow-xs"
              data-trend-direction={direction}
            >
              <Icon className="size-3.5" aria-hidden />
              {delta}
            </Badge>
          ) : null}
        </div>
        {points.length > 1 ? (
          <ChartContainer
            config={chartConfig}
            aria-label={`${label} trend from ${points[0]?.label} to ${points.at(-1)?.label}`}
            className="h-12 w-full min-w-0 aspect-auto"
            initialDimension={{ width: 320, height: 48 }}
          >
            <LineChart
              data={points}
              accessibilityLayer
              margin={{ top: 5, right: 3, bottom: 5, left: 3 }}
            >
              {typeof threshold === "number" ? (
                <ReferenceLine
                  y={threshold}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.45}
                  ifOverflow="extendDomain"
                />
              ) : null}
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent labelKey="label" indicator="line" />}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-value)" }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="text-xs text-muted-foreground">Trend appears after two measured periods.</p>
        )}
        {detail ? <p className="text-xs leading-5 text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}
