import Link from "next/link";
import { Children } from "react";
import type { ReactNode } from "react";
import { ArrowRight, SlidersHorizontal, type LucideIcon } from "lucide-react";

import { EmptyState as AppEmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const shellWidths = {
  "6xl": "max-w-none",
  "7xl": "max-w-none",
  wide: "max-w-none",
  full: "max-w-none",
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
  size = "full",
}: PageShellProps) {
  return (
    <main
      id="main-content"
      className={cn(
        "min-h-screen px-4 py-4 pb-[calc(8.75rem+env(safe-area-inset-bottom))] text-foreground sm:px-6 sm:pb-8 sm:pt-6 lg:px-8",
        className,
      )}
    >
      <div
        className={cn(
          // Keep app content full-width; see AGENTS.md layout contract.
          "mx-auto flex min-w-0 w-full flex-col gap-4 sm:gap-5 lg:gap-6 [&>*]:min-w-0",
          shellWidths[size],
          contentClassName,
          "!max-w-none",
        )}
      >
        {children}
      </div>
    </main>
  );
}

type PageHeaderMetric = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
};

type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  metrics?: PageHeaderMetric[];
  visual?: ReactNode;
  visualSize?: "compact" | "wide";
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  metrics,
  visual,
  visualSize = "compact",
  className,
}: PageHeaderProps) {
  const primaryMetric = metrics?.[0];
  const hasWideVisual = Boolean(visual) && visualSize === "wide";

  return (
    <>
      <header className={cn("premium-hero grid gap-3 p-3 sm:hidden", className)}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="min-w-0">
            {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
            <h1 className="text-xl font-semibold leading-tight tracking-normal text-balance text-foreground">
              {title}
            </h1>
            {description && !primaryMetric && !actions ? (
              <p className="mt-1 line-clamp-1 text-sm leading-5 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {visual ? (
            <div
              className="h-14 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-emerald-950/10"
              data-compact-media
            >
              {visual}
            </div>
          ) : null}
        </div>
        {primaryMetric || actions ? (
          <div
            className={cn(
              "premium-command-surface grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-2",
              primaryMetric?.className,
            )}
          >
            {primaryMetric ? (
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {primaryMetric.label}
                </p>
                <p className="mt-0.5 truncate text-xl font-semibold tracking-normal">
                  {primaryMetric.value}
                </p>
                {primaryMetric.detail ? (
                  <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
                    {primaryMetric.detail}
                  </p>
                ) : null}
              </div>
            ) : (
              <span aria-hidden />
            )}
            {actions ? (
              <div
                data-primary-action
                className="flex max-w-40 shrink-0 gap-2 [&>*:not(:first-child)]:hidden [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:px-3.5"
              >
                {actions}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <header className={cn("desktop-page-header hidden sm:block", className)}>
        <div
          className={cn(
            "grid gap-4",
            visual && !hasWideVisual ? "lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center" : "",
            hasWideVisual
              ? "lg:grid-cols-[minmax(0,0.72fr)_minmax(420px,0.58fr)] lg:items-center"
              : "",
          )}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-1.5">
              {eyebrow ? <div>{eyebrow}</div> : null}
              <div className="space-y-1.5">
                <h1 className="text-3xl font-semibold leading-tight tracking-normal text-balance text-foreground">
                  {title}
                </h1>
                {description ? (
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
                ) : null}
              </div>
            </div>
            {actions ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                {actions}
              </div>
            ) : null}
          </div>
          {visual ? (
            <div
              className={cn(
                "hidden overflow-hidden rounded-lg ring-1 ring-emerald-950/10 lg:block",
                hasWideVisual ? "h-44" : "h-28",
              )}
              data-compact-media
            >
              {visual}
            </div>
          ) : null}
        </div>
        {metrics?.length ? (
          <div
            className={cn(
              "mt-4 grid auto-cols-[minmax(9.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4",
              metrics.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4",
            )}
          >
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className={cn(
                  "metric-tile desktop-metric-tile luxury-metric-card",
                  metric.className,
                )}
              >
                <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-1 truncate text-2xl font-semibold tracking-normal sm:text-[1.5rem]">
                  {metric.value}
                </p>
                {metric.detail ? (
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{metric.detail}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </header>
    </>
  );
}

export function MobileCompactPageHeader({
  eyebrow,
  title,
  description,
  metricLabel,
  metricValue,
  metricDetail,
  action,
  visual,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metricLabel?: ReactNode;
  metricValue?: ReactNode;
  metricDetail?: ReactNode;
  action?: ReactNode;
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("premium-hero grid gap-3 p-3 sm:hidden", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
          <h1 className="text-xl font-semibold leading-tight tracking-normal text-balance text-foreground">
            {title}
          </h1>
          {description && !metricLabel && !action ? (
            <p className="mt-1 line-clamp-1 text-sm leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {visual ? (
          <div
            className="h-14 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-emerald-950/10"
            data-compact-media
          >
            {visual}
          </div>
        ) : null}
      </div>
      {metricLabel || action ? (
        <div className="premium-command-surface grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-2">
          {metricLabel ? (
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {metricLabel}
              </p>
              <p className="mt-0.5 truncate text-xl font-semibold tracking-normal">{metricValue}</p>
              {metricDetail ? (
                <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
                  {metricDetail}
                </p>
              ) : null}
            </div>
          ) : (
            <span aria-hidden />
          )}
          {action ? (
            <div
              data-primary-action
              className="flex shrink-0 gap-2 [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:px-3.5"
            >
              {action}
            </div>
          ) : null}
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
      tabIndex={0}
      className={cn(
        "focus-aaa sticky top-[4.75rem] z-30 -mx-1 flex gap-2 overflow-x-auto px-1 py-1 outline-none sm:hidden",
        "premium-route-tabs rounded-lg",
        className,
      )}
    >
      {items.map((item, index) => (
        <a
          key={`${item.label}-${item.href}-${index}`}
          href={item.href}
          className="focus-aaa min-h-11 shrink-0 rounded-md border border-transparent px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition-[border-color,background-color,color,box-shadow,transform] duration-150 ease-out hover:border-emerald-800/20 hover:bg-white/60 hover:text-foreground active:scale-[0.98]"
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
    <div
      className={cn(
        "fixed inset-x-4 bottom-[calc(5.95rem+env(safe-area-inset-bottom))] z-40 sm:hidden",
        "pointer-events-none",
        className,
      )}
    >
      <div
        data-sticky-mobile-action
        className="premium-mobile-action-bar pointer-events-auto rounded-lg p-2 [&_[data-slot=button]]:min-h-11 [&_a]:min-h-11 [&_button]:min-h-11"
      >
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
    <div
      tabIndex={0}
      className={cn("focus-aaa flex gap-2 overflow-x-auto pb-1 outline-none", className)}
    >
      {items.map((item) => {
        const content = (
          <span className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-emerald-900/10 bg-white/80 px-3.5 text-sm font-semibold text-slate-700 shadow-sm">
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
    <div className={cn("sm:hidden", className)}>
      <Drawer>
        <DrawerTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "premium-command-surface min-h-11 w-full justify-center rounded-lg shadow-sm",
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {label}
          {activeCount > 0 ? (
            <Badge variant="secondary" className="ml-1 rounded-full px-1.5 py-0 text-[11px]">
              {activeCount}
            </Badge>
          ) : null}
        </DrawerTrigger>
        <DrawerContent className="max-h-[86vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{label}</DrawerTitle>
            <DrawerDescription>Refine the current view without leaving the page.</DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="overflow-y-auto px-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
            {children}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export function MobileFilterCommandSheet({
  children,
  chips,
  label = "Filter",
  activeCount,
  className,
}: {
  children: ReactNode;
  chips?: Array<{ label: string; href?: string }>;
  label?: string;
  activeCount?: number;
  className?: string;
}) {
  const count = activeCount ?? chips?.length ?? 0;

  return (
    <div className={cn("grid gap-3 sm:hidden", className)}>
      <MobileFilterSheet label={label} activeCount={count}>
        {children}
      </MobileFilterSheet>
      {chips?.length ? <ActiveFilterChips items={chips} /> : null}
    </div>
  );
}

export function MobileHorizontalRail({
  children,
  title,
  description,
  action,
  className,
  itemClassName = "min-w-[78vw] max-w-[22rem]",
}: {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const items = Children.toArray(children).filter(Boolean);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className={cn("grid min-w-0 max-w-full gap-3 overflow-hidden sm:hidden", className)}>
      {title || action ? (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold tracking-normal">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="-mx-4 max-w-[100vw] overflow-hidden">
        <div
          aria-label={typeof title === "string" ? `${title} cards` : "Mobile carousel cards"}
          tabIndex={0}
          className="flex w-full snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {items.map((item, index) => (
            <div key={index} className={cn("shrink-0 snap-start", itemClassName)}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type MobileBentoSummaryItem = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  action?: ReactNode;
  tone?: Tone;
};

export function MobileBentoSummary({
  items,
  className,
}: {
  items: MobileBentoSummaryItem[];
  className?: string;
}) {
  const visibleItems = items.slice(0, 4);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:hidden", className)}>
      {visibleItems.map((item, index) => {
        const tone = item.tone ?? "green";
        const content = (
          <div
            className={cn(
              "apple-panel-strong grid min-h-20 content-between gap-2 p-3",
              index === 0 ? "col-span-2 min-h-[5.5rem]" : "",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {item.label}
                </p>
                <span className={cn("size-2 rounded-full ring-4", compactToneClasses[tone])} />
              </div>
              <p
                className={cn(
                  "mt-1 truncate font-semibold tracking-normal",
                  index === 0 ? "text-xl" : "text-lg",
                )}
              >
                {item.value}
              </p>
              {item.detail ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {item.detail}
                </p>
              ) : null}
            </div>
            {item.action ? (
              <div className="[&_[data-slot=button]]:min-h-11">{item.action}</div>
            ) : null}
          </div>
        );

        if (item.href) {
          return (
            <Link key={index} href={item.href} prefetch={false} className="block">
              {content}
            </Link>
          );
        }

        return <div key={index}>{content}</div>;
      })}
    </div>
  );
}

export function MobileCompanionHero({
  eyebrow,
  title,
  description,
  metricLabel,
  metricValue,
  metricDetail,
  action,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metricLabel?: ReactNode;
  metricValue?: ReactNode;
  metricDetail?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("premium-hero grid gap-3 rounded-lg p-3 sm:hidden", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h2 className="text-2xl font-semibold leading-tight tracking-normal text-balance">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {metricLabel || action ? (
        <div className="premium-command-surface grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-3 py-2.5">
          {metricLabel ? (
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {metricLabel}
              </p>
              <p className="mt-0.5 truncate text-xl font-semibold tracking-normal">{metricValue}</p>
              {metricDetail ? (
                <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
                  {metricDetail}
                </p>
              ) : null}
            </div>
          ) : (
            <span aria-hidden />
          )}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children ? <div className="grid gap-2">{children}</div> : null}
    </section>
  );
}

export function MobileQuickDecisionCard({
  label,
  value,
  detail,
  tone = "green",
  href,
  action,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  href?: string;
  action?: ReactNode;
  className?: string;
}) {
  const content = (
    <div className={cn("apple-panel-strong grid gap-3 rounded-lg p-3 sm:hidden", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold leading-6 tracking-normal">{value}</p>
          {detail ? (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{detail}</p>
          ) : null}
        </div>
        <span className={cn("mt-1 size-2.5 rounded-full ring-4", compactToneClasses[tone])} />
      </div>
      {action ? <div data-primary-action>{action}</div> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} prefetch={false} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export function MobilePrimaryActionCard({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "premium-command-surface grid gap-3 rounded-lg p-3 sm:hidden [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:w-full [&_[data-slot=button]]:rounded-lg",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-normal text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div data-primary-action>{action}</div>
    </section>
  );
}

export function MobileCompanionAccordion({
  items,
  defaultValue,
  className,
}: {
  items: Array<{
    value: string;
    title: ReactNode;
    summary?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    defaultOpen?: boolean;
  }>;
  defaultValue?: string;
  className?: string;
}) {
  const resolvedDefaultValue = defaultValue ?? items.find((item) => item.defaultOpen)?.value;

  if (items.length === 0) {
    return null;
  }

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={resolvedDefaultValue}
      className={cn("grid gap-2 sm:hidden", className)}
    >
      {items.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          className="premium-card overflow-hidden rounded-lg border border-border/70"
        >
          <AccordionTrigger className="min-h-12 px-3 py-2 text-left no-underline hover:no-underline">
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate text-sm font-semibold tracking-normal">{item.title}</span>
              {item.description ? (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {item.description}
                </span>
              ) : null}
            </span>
            {item.summary ? (
              <span className="ml-auto max-w-36 shrink-0 truncate text-xs font-medium text-muted-foreground">
                {item.summary}
              </span>
            ) : null}
          </AccordionTrigger>
          <AccordionContent className="border-t border-border/70 p-3">
            {item.children}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function MobileAccordionSection({
  title,
  count,
  summary,
  description,
  children,
  defaultOpen = false,
  className,
  contentClassName,
}: {
  title: ReactNode;
  count?: ReactNode;
  summary?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? "mobile-section" : undefined}
      className={cn("sm:hidden", className)}
    >
      <AccordionItem
        value="mobile-section"
        className="premium-card overflow-hidden rounded-lg border border-border/70"
      >
        <AccordionTrigger className="min-h-12 px-3 py-2 no-underline hover:no-underline">
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate text-sm font-semibold tracking-normal">{title}</span>
            {description ? (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {description}
              </span>
            ) : null}
          </span>
          {count || summary ? (
            <span className="ml-auto max-w-36 shrink-0 truncate text-xs font-medium text-muted-foreground">
              {count ?? summary}
            </span>
          ) : null}
        </AccordionTrigger>
        <AccordionContent className={cn("border-t border-border/70 p-3", contentClassName)}>
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function MobileCurrentItemCard({
  title,
  subtitle,
  selector,
  action,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  selector?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3 sm:hidden", className)}>
      {selector ? <div className="-mx-1 overflow-x-auto px-1 pb-1">{selector}</div> : null}
      <div className="premium-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-normal text-[#111611]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <div className="mt-3 grid gap-3">{children}</div>
      </div>
    </section>
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
          <summary className="mt-2 flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-white/80 px-3 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
            {moreLabel}
          </summary>
          <div className="contents">
            {hiddenItems.map((item, index) => render(item, index + initialCount))}
          </div>
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
    <Card
      className={cn(
        "premium-card luxury-metric-card h-full transition-[border-color,box-shadow,transform] duration-150 ease-out group-hover:-translate-y-0.5 group-hover:border-[#0B7A3B]",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="space-y-1">
          <CardDescription className="font-medium uppercase tracking-[0.12em]">
            {label}
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tracking-normal">{value}</CardTitle>
        </div>
        {Icon ? (
          <div
            className={cn("grid size-8 place-items-center rounded-md ring-1", toneClasses[tone])}
          >
            <Icon className="size-5" />
          </div>
        ) : null}
      </CardHeader>
      {detail ? (
        <CardContent>
          <p className="text-sm leading-5 text-muted-foreground">{detail}</p>
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
  return (
    <Card id={id} className={cn("premium-card desktop-data-panel", className)}>
      {children}
    </Card>
  );
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
    <CardHeader className="gap-1 border-b border-border/70 bg-white/35 px-4 py-3">
      <div>
        <CardTitle className="text-lg font-semibold tracking-normal text-[#111611] sm:text-xl">
          {title}
        </CardTitle>
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
      className={cn(
        "w-fit border-0 px-2.5 py-1 text-xs font-medium ring-1 hover:bg-transparent",
        toneClasses[tone],
        className,
      )}
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
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
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
    <div className={cn("premium-rail-card overflow-hidden rounded-lg", className)}>
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
      <span
        className={cn("mt-1.5 size-2.5 shrink-0 rounded-full ring-4", compactToneClasses[tone])}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {item.label}
        </span>
        <span className="mt-1 block truncate text-base font-semibold tracking-normal text-slate-950">
          {item.value}
        </span>
        {item.detail ? (
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">{item.detail}</span>
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
    "flex min-h-20 min-w-0 items-start gap-3 border-b border-border/70 px-3 py-2.5 md:border-r";
  const title = item.title ?? stringValue(item.detail);

  if (item.href) {
    return (
      <Link
        href={item.href}
        prefetch={false}
        title={title}
        aria-label={
          item.ariaLabel ??
          [stringValue(item.label), stringValue(item.value), stringValue(item.detail)]
            .filter(Boolean)
            .join(". ")
        }
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
    <div className={cn("premium-rail-card overflow-hidden rounded-lg", className)}>
      <div
        className={cn(
          "grid auto-cols-[minmax(15rem,1fr)] grid-flow-col overflow-x-auto sm:grid-flow-row sm:overflow-visible",
          columnsClassName,
        )}
      >
        {items.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            prefetch={false}
            title={item.description}
            aria-label={item.description ? `${item.title}: ${item.description}` : item.title}
            className="group flex min-h-12 min-w-0 items-center gap-3 border-b border-border/70 px-3 py-2 transition-colors hover:bg-emerald-50/70 sm:border-r"
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
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
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
      <div
        className={cn(
          mobile ? "hidden sm:block" : "block",
          "apple-panel-strong overflow-hidden",
          className,
        )}
      >
        <ScrollArea className="w-full">{children}</ScrollArea>
      </div>
      {mobile ? <div className="min-w-0 overflow-hidden sm:hidden">{mobile}</div> : null}
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
    <div className={cn("grid min-w-0 gap-3", className)}>{hasChildren ? children : empty}</div>
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
          {subtitle ? (
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="max-w-[42%] shrink-0 overflow-hidden">{action}</div> : null}
      </div>
      {children ? <div className="mt-3 grid min-w-0 gap-2">{children}</div> : null}
    </>
  );

  const cardClassName = cn(
    "apple-panel-strong block w-full min-w-0 overflow-hidden p-3 text-left transition-colors hover:border-emerald-300",
    className,
  );

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
    <div
      className={cn(
        "trust-indicator flex min-w-0 max-w-full items-center justify-between gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm",
        className,
      )}
    >
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-semibold tabular-nums">{value}</span>
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
    <AppEmptyState
      icon={icon}
      title={title}
      description={description}
      action={action}
      className="apple-panel min-h-32 sm:min-h-44"
    />
  );
}

export function ChartFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("chart-frame", className)}>{children}</div>;
}
