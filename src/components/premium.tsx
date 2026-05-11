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
import { cn } from "@/lib/utils";

const shellWidths = {
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-[1500px]",
};

type PageShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  size?: keyof typeof shellWidths;
};

export function PageShell({
  children,
  className,
  contentClassName,
  size = "7xl",
}: PageShellProps) {
  return (
    <main className={cn("min-h-screen px-4 py-5 text-foreground sm:px-6 lg:px-8", className)}>
      <div className={cn("mx-auto flex w-full flex-col gap-5", shellWidths[size], contentClassName)}>
        {children}
      </div>
    </main>
  );
}

type PageHeaderMetric = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
};

type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  metrics?: PageHeaderMetric[];
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  metrics,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("premium-hero p-5 sm:p-7", className)}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          {eyebrow ? <div>{eyebrow}</div> : null}
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-col gap-2 sm:flex-row">{actions}</div> : null}
      </div>
      {metrics?.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="metric-tile">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-normal">{metric.value}</p>
              {metric.detail ? <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}

type MetricCardProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  icon?: LucideIcon;
  tone?: "green" | "sky" | "pink" | "amber" | "slate";
  className?: string;
};

const toneClasses = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  pink: "bg-pink-50 text-pink-700 ring-pink-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function MetricCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  tone = "green",
  className,
}: MetricCardProps) {
  const card = (
    <Card className={cn("premium-card h-full transition group-hover:-translate-y-0.5", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-4xl font-semibold tracking-normal">{value}</CardTitle>
        </div>
        {Icon ? (
          <div className={cn("grid size-10 place-items-center rounded-full ring-1", toneClasses[tone])}>
            <Icon className="size-5" />
          </div>
        ) : null}
      </CardHeader>
      {detail ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </CardContent>
      ) : null}
    </Card>
  );

  if (!href) {
    return card;
  }

  return (
    <Link href={href} prefetch={false} className="group block">
      {card}
    </Link>
  );
}

export function DataPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <Card className={cn("premium-card", className)}>{children}</Card>;
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <CardHeader>
      <div>
        <CardTitle className="text-2xl tracking-normal">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </div>
      {action ? <CardAction>{action}</CardAction> : null}
    </CardHeader>
  );
}

export function StatusPill({
  children,
  tone = "green",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof toneClasses;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("w-fit border-0 px-2.5 py-1 ring-1 hover:bg-transparent", toneClasses[tone], className)}
    >
      {children}
    </Badge>
  );
}

export function InsightBlock({
  label,
  value,
  detail,
  tone = "green",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: keyof typeof toneClasses;
}) {
  return (
    <div className="rounded-xl border bg-white/76 p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className={cn("size-2 rounded-full ring-4", toneClasses[tone])} />
      </div>
      <p className="mt-3 text-xl font-semibold tracking-normal">{value}</p>
      {detail ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
