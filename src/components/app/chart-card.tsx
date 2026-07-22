import type { ComponentProps, ReactNode } from "react";

import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer } from "@/components/ui/chart";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfidenceIndicator, type ProductConfidence } from "@/components/app/evidence-status";
import { cn } from "@/lib/utils";

type ChartCardProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  config: ChartConfig;
  children: ComponentProps<typeof ChartContainer>["children"];
  className?: string;
  chartClassName?: string;
  sampleSize?: number;
  dateRange?: string;
  sourceLabel?: string;
  confidence?: ProductConfidence;
  comparisonToggle?: ReactNode;
  exportAction?: ReactNode;
  dataTable?: ReactNode;
  emptyState?: ReactNode;
};

export function ChartCard({
  title,
  description,
  action,
  config,
  children,
  className,
  chartClassName,
  sampleSize,
  dateRange,
  sourceLabel,
  confidence,
  comparisonToggle,
  exportAction,
  dataTable,
  emptyState,
}: ChartCardProps) {
  const metadata = [
    sampleSize !== undefined ? `${sampleSize} ${sampleSize === 1 ? "shot" : "shots"}` : null,
    dateRange,
    sourceLabel,
  ].filter((item): item is string => Boolean(item));

  return (
    <Card
      data-chart-system="forekinghell"
      className={cn("premium-card desktop-data-panel", className)}
    >
      <CardHeader className="clubhouse-chart-header border-b border-border/70 bg-card/35">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
          {metadata.length > 0 || confidence ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {metadata.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border/70 bg-muted/55 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {item}
                </span>
              ))}
              {confidence ? <ConfidenceIndicator label={confidence} /> : null}
            </div>
          ) : null}
        </div>
        {action || comparisonToggle || exportAction ? (
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            {comparisonToggle}
            {exportAction}
            {action}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {emptyState ?? (
          <ChartContainer
            config={config}
            className={cn("chart-frame min-h-52 w-full", chartClassName)}
          >
            {children}
          </ChartContainer>
        )}
        {dataTable ? <div className="mt-4 border-t border-border/70 pt-4">{dataTable}</div> : null}
      </CardContent>
    </Card>
  );
}
