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
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  pink: "bg-pink-50 text-pink-700 ring-pink-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
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
          <CardDescription className="truncate">{label}</CardDescription>
          <CardTitle className="truncate text-2xl font-semibold tracking-normal">{value}</CardTitle>
        </div>
        <CardAction className="flex items-center gap-2">
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          {Icon ? (
            <span
              className={cn("grid size-8 place-items-center rounded-md ring-1", toneClasses[tone])}
            >
              <Icon className="size-4" />
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
      className={cn("group block self-start", stretch && "h-full self-stretch")}
    >
      {content}
    </Link>
  ) : (
    content
  );
}
