import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PageHeaderMetric = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
};

type AppPageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  metrics?: PageHeaderMetric[];
  className?: string;
};

export function AppPageHeader({
  eyebrow,
  title,
  description,
  actions,
  metrics,
  className,
}: AppPageHeaderProps) {
  return (
    <Card className={cn("premium-card overflow-hidden", className)}>
      <CardHeader className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {typeof eyebrow === "string" ? <Badge>{eyebrow}</Badge> : eyebrow}
            </div>
          ) : null}
          <CardTitle className="text-2xl font-semibold tracking-normal sm:text-3xl">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="mt-2 max-w-2xl text-sm leading-6">
              {description}
            </CardDescription>
          ) : null}
        </div>
        {actions ? <CardAction className="flex flex-wrap gap-2">{actions}</CardAction> : null}
      </CardHeader>
      {metrics?.length ? (
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="metric-tile">
                <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-1 truncate text-2xl font-semibold">
                  {metric.value}
                </p>
                {metric.detail ? (
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {metric.detail}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
