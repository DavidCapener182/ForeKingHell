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
import { cn } from "@/lib/utils";

type ChartCardProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  config: ChartConfig;
  children: ComponentProps<typeof ChartContainer>["children"];
  className?: string;
  chartClassName?: string;
};

export function ChartCard({
  title,
  description,
  action,
  config,
  children,
  className,
  chartClassName,
}: ChartCardProps) {
  return (
    <Card className={cn("premium-card desktop-data-panel", className)}>
      <CardHeader className="clubhouse-chart-header border-b border-border/70 bg-card/35">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={config}
          className={cn("chart-frame min-h-52 w-full", chartClassName)}
        >
          {children}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
