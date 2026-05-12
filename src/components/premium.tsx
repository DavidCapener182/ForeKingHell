import Link from "next/link";
import { Children } from "react";
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
    <main className={cn("min-h-screen px-4 py-5 pb-24 text-foreground sm:px-6 sm:pb-8 lg:px-8", className)}>
      <div className={cn("mx-auto flex w-full flex-col gap-5 sm:gap-6", shellWidths[size], contentClassName)}>
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
            <h1 className="text-3xl font-semibold leading-tight tracking-normal text-balance sm:text-5xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">{actions}</div> : null}
      </div>
      {metrics?.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="metric-tile">
              <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-2 truncate text-2xl font-semibold tracking-normal sm:text-3xl">{metric.value}</p>
              {metric.detail ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{metric.detail}</p> : null}
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

type Tone = keyof typeof toneClasses;

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
          <CardTitle className="text-3xl font-semibold tracking-normal sm:text-4xl">{value}</CardTitle>
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
    <CardHeader className="gap-3">
      <div>
        <CardTitle className="text-xl tracking-normal sm:text-2xl">{title}</CardTitle>
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
  tone?: Tone;
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
  tone?: Tone;
}) {
  return (
    <div className="apple-panel-strong p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <span className={cn("size-2 rounded-full ring-4", toneClasses[tone])} />
      </div>
      <p className="mt-3 text-lg font-semibold tracking-normal sm:text-xl">{value}</p>
      {detail ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function PageActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      {children}
    </div>
  );
}

export function FilterPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DataPanel className={className}>
      <CardContent className="pt-4">
        <div className="apple-panel grid gap-3 p-3">{children}</div>
      </CardContent>
    </DataPanel>
  );
}

export function DataTableFrame({
  children,
  mobile,
  className,
}: {
  children: ReactNode;
  mobile?: ReactNode;
  className?: string;
}) {
  return (
    <>
      <div className={cn(mobile ? "hidden sm:block" : "block", "apple-panel-strong overflow-hidden", className)}>
        {children}
      </div>
      {mobile ? <div className="sm:hidden">{mobile}</div> : null}
    </>
  );
}

export function MobileDataList({
  children,
  empty,
  className,
}: {
  children: ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  const hasChildren = Children.count(children) > 0;

  return (
    <div className={cn("grid gap-3", className)}>
      {hasChildren ? children : empty}
    </div>
  );
}

export function MobileDataCard({
  title,
  subtitle,
  href,
  action,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const content = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-normal">{title}</p>
          {subtitle ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-3 grid gap-2">{children}</div> : null}
    </>
  );

  const cardClassName = cn("apple-panel-strong block p-3 text-left transition-colors hover:border-emerald-300", className);

  if (href) {
    return (
      <Link href={href} prefetch={false} className={cardClassName}>
        {content}
      </Link>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}

export function DataPair({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-50/80 px-3 py-2 text-sm", className)}>
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="apple-panel grid place-items-center px-4 py-12 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        {icon ? <div className="grid size-11 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">{icon}</div> : null}
        <div>
          <p className="text-lg font-semibold tracking-normal">{title}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

export function ChartFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("chart-frame", className)}>{children}</div>;
}
