import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const toneClasses = {
  green:
    "bg-[var(--status-success-surface)] text-[var(--status-success-foreground)] ring-[var(--status-success-border)]",
  sky: "bg-[var(--status-information-surface)] text-[var(--status-information-foreground)] ring-[var(--status-information-border)]",
  pink: "bg-destructive/10 text-destructive ring-destructive/25",
  amber:
    "bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)] ring-[var(--status-warning-border)]",
  slate: "bg-muted text-muted-foreground ring-border",
};

type AppMetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  icon?: LucideIcon;
  tone?: keyof typeof toneClasses;
  badge?: ReactNode;
  progress?: number;
  stretch?: boolean;
  className?: string;
};

export function AppMetricCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  tone = "green",
  badge,
  progress,
  stretch = true,
  className,
}: AppMetricCardProps) {
  const content = (
    <Card
      data-stretch={stretch ? "true" : undefined}
      className={cn(
        "premium-card luxury-metric-card transition-colors hover:border-primary/40",
        stretch ? "h-full self-stretch" : "self-start",
        className,
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardDescription className="text-sm font-medium">{label}</CardDescription>
          <CardTitle
            data-operational-value
            className="mt-2 break-words text-3xl font-semibold tracking-tight [font-variant-numeric:tabular-nums]"
          >
            {value}
          </CardTitle>
        </div>
        <CardAction className="flex items-center gap-2">
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          {Icon ? (
            <span
              data-tone={tone}
              data-tone-role="surface"
              className={cn(
                "grid size-11 place-items-center rounded-xl ring-1 shadow-xs",
                toneClasses[tone],
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
          ) : null}
        </CardAction>
      </CardHeader>
      {detail || typeof progress === "number" ? (
        <CardContent className="grid gap-3">
          {detail ? <p className="text-sm leading-5 text-muted-foreground">{detail}</p> : null}
          {typeof progress === "number" ? (
            <Progress value={Math.max(0, Math.min(100, progress))} />
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );

  return href ? (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "group block self-start rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4",
        stretch && "h-full self-stretch",
      )}
    >
      {content}
    </Link>
  ) : (
    content
  );
}
