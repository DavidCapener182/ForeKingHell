import Link from "next/link";
import { Children } from "react";
import type { ReactNode } from "react";
import { ArrowRight, SlidersHorizontal, type LucideIcon } from "lucide-react";

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
    <header className={cn("premium-hero p-4 sm:p-7", className)}>
      <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2 sm:space-y-3">
          {eyebrow ? <div>{eyebrow}</div> : null}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-tight tracking-normal text-balance sm:text-5xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">{actions}</div> : null}
      </div>
      {metrics?.length ? (
        <div className="-mx-1 mt-4 grid auto-cols-[minmax(9.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:mt-6 sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
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

export function MobileSectionChips({
  items,
  className,
}: {
  items: Array<{ label: string; href: string }>;
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Page sections"
      className={cn(
        "sticky top-[4.75rem] z-30 -mx-1 flex gap-2 overflow-x-auto px-1 py-1 sm:hidden",
        className,
      )}
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="min-h-10 shrink-0 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function StickyMobileAction({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("fixed inset-x-4 bottom-24 z-40 sm:hidden", className)}>
      <div className="rounded-2xl border border-white/70 bg-white/90 p-2 shadow-xl shadow-slate-950/15 backdrop-blur">
        {children}
      </div>
    </div>
  );
}

export function ActiveFilterChips({
  items,
  className,
}: {
  items: Array<{ label: string; href?: string }>;
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {items.map((item) => {
        const content = (
          <span className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
            {item.label}
          </span>
        );

        return item.href ? (
          <Link key={item.label} href={item.href} prefetch={false}>
            {content}
          </Link>
        ) : (
          <span key={item.label}>{content}</span>
        );
      })}
    </div>
  );
}

export function MobileFilterSheet({
  children,
  label = "Filter",
  activeCount = 0,
  className,
}: {
  children: ReactNode;
  label?: string;
  activeCount?: number;
  className?: string;
}) {
  return (
    <details className={cn("group sm:hidden", className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold shadow-sm [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4" aria-hidden />
        {label}
        {activeCount > 0 ? (
          <Badge variant="secondary" className="ml-1 rounded-full px-1.5 py-0 text-[11px]">
            {activeCount}
          </Badge>
        ) : null}
      </summary>
      <div className="fixed inset-x-0 bottom-0 z-[60] max-h-[82vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] shadow-2xl shadow-slate-950/20">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
        {children}
      </div>
    </details>
  );
}

export function TopThreeDisclosure({
  items,
  renderItem,
  initialCount = 3,
  moreLabel = "Show more",
  className,
}: {
  items: ReactNode[];
  renderItem?: (item: ReactNode, index: number) => ReactNode;
  initialCount?: number;
  moreLabel?: string;
  className?: string;
}) {
  const visibleItems = items.slice(0, initialCount);
  const hiddenItems = items.slice(initialCount);
  const render = renderItem ?? ((item: ReactNode) => item);

  if (hiddenItems.length === 0) {
    return <div className={className}>{visibleItems.map(render)}</div>;
  }

  return (
    <>
      <div className={cn("sm:hidden", className)}>
        {visibleItems.map(render)}
        <details className="contents">
          <summary className="mt-2 flex min-h-11 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
            {moreLabel}
          </summary>
          <div className="contents">{hiddenItems.map((item, index) => render(item, index + initialCount))}</div>
        </details>
      </div>
      <div className={cn("hidden sm:grid", className)}>{items.map(render)}</div>
    </>
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

export type Tone = keyof typeof toneClasses;

const compactToneClasses: Record<Tone, string> = {
  green: "bg-emerald-500 ring-emerald-100",
  sky: "bg-sky-500 ring-sky-100",
  pink: "bg-pink-500 ring-pink-100",
  amber: "bg-amber-500 ring-amber-100",
  slate: "bg-slate-400 ring-slate-200",
};

export type CompactReadoutItem = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  href?: string;
  title?: string;
  ariaLabel?: string;
};

export type CompactLinkGridItem = {
  title: string;
  description?: string;
  href: string;
  metric?: ReactNode;
  icon: LucideIcon;
  accent: string;
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
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return <Card id={id} className={cn("premium-card", className)}>{children}</Card>;
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

export function CompactReadoutGrid({
  items,
  columnsClassName = "md:grid-cols-2 xl:grid-cols-4",
  className,
}: {
  items: CompactReadoutItem[];
  columnsClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]", className)}>
      <div className={cn("grid", columnsClassName)}>
        {items.map((item, index) => (
          <CompactReadoutCell key={readoutKey(item, index)} item={item} />
        ))}
      </div>
    </div>
  );
}

function CompactReadoutCell({ item }: { item: CompactReadoutItem }) {
  const tone = item.tone ?? "green";
  const content = (
    <>
      <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full ring-4", compactToneClasses[tone])} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {item.label}
        </span>
        <span className="mt-1 block truncate text-base font-semibold tracking-normal text-slate-950">
          {item.value}
        </span>
        {item.detail ? (
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {item.detail}
          </span>
        ) : null}
      </span>
      {item.href ? (
        <ArrowRight
          className="mt-5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700"
          aria-hidden
        />
      ) : null}
    </>
  );
  const baseClassName =
    "flex min-h-20 min-w-0 items-start gap-3 border-b border-slate-200/70 px-3 py-2.5 md:border-r";
  const title = item.title ?? stringValue(item.detail);

  if (item.href) {
    return (
      <Link
        href={item.href}
        prefetch={false}
        title={title}
        aria-label={item.ariaLabel ?? [stringValue(item.label), stringValue(item.value), stringValue(item.detail)].filter(Boolean).join(". ")}
        className={cn(baseClassName, "group transition-colors hover:bg-emerald-50/70")}
      >
        {content}
      </Link>
    );
  }

  return (
    <div title={title} className={baseClassName}>
      {content}
    </div>
  );
}

export function CompactLinkGrid({
  items,
  columnsClassName = "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  className,
}: {
  items: CompactLinkGridItem[];
  columnsClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]", className)}>
      <div className={cn("grid auto-cols-[minmax(15rem,1fr)] grid-flow-col overflow-x-auto sm:grid-flow-row sm:overflow-visible", columnsClassName)}>
        {items.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            prefetch={false}
            title={item.description}
            aria-label={item.description ? `${item.title}: ${item.description}` : item.title}
            className="group flex min-h-12 min-w-0 items-center gap-3 border-b border-slate-200/70 px-3 py-2 transition-colors hover:bg-emerald-50/70 sm:border-r"
          >
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", item.accent)}>
              <item.icon className="size-4" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-semibold">{item.title}</span>
              {item.metric ? (
                <Badge variant="outline" className="shrink-0 bg-white/70 px-1.5 py-0 text-[11px]">
                  {item.metric}
                </Badge>
              ) : null}
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

function readoutKey(item: CompactReadoutItem, index: number) {
  const label = stringValue(item.label) || "item";
  const value = stringValue(item.value) || "";
  return `${label}-${value}-${index}`;
}

function stringValue(value: ReactNode) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
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
