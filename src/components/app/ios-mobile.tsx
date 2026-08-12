import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export function IOSSectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      data-ios-section-header
      className={cn("flex min-w-0 items-end justify-between gap-3 px-1", className)}
    >
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.035em] text-muted-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-[1.15rem] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function IOSGroupedList({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div
      data-ios-grouped-list
      aria-label={label}
      className={cn("ios-grouped-list min-w-0 overflow-hidden", className)}
    >
      {children}
    </div>
  );
}

export function IOSInlineStatus({
  label,
  tone = "neutral",
  className,
}: {
  label: ReactNode;
  tone?: "positive" | "attention" | "critical" | "info" | "neutral";
  className?: string;
}) {
  return (
    <span
      data-ios-inline-status={tone}
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 text-xs font-medium",
        tone === "positive" && "text-emerald-700 dark:text-emerald-300",
        tone === "attention" && "text-amber-700 dark:text-amber-300",
        tone === "critical" && "text-destructive",
        tone === "info" && "text-primary",
        tone === "neutral" && "text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full bg-current", tone === "neutral" && "opacity-65")}
      />
      {label}
    </span>
  );
}

export function IOSListRow({
  label,
  value,
  detail,
  href,
  icon: Icon,
  leading,
  trailing,
  status,
  destructive = false,
  className,
  ariaLabel,
  onClick,
}: {
  label: ReactNode;
  value?: ReactNode;
  detail?: ReactNode;
  href?: string;
  icon?: LucideIcon;
  leading?: ReactNode;
  trailing?: ReactNode;
  status?: ReactNode;
  destructive?: boolean;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {leading ??
        (Icon ? (
          <span
            data-ios-row-icon
            className="grid size-8 shrink-0 place-items-center rounded-[0.55rem] bg-primary/10 text-primary"
          >
            <Icon className="size-[1.125rem]" aria-hidden />
          </span>
        ) : null)}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px] font-medium leading-5",
            destructive ? "text-destructive" : "text-foreground",
          )}
        >
          {label}
        </span>
        {detail ? (
          <span className="mt-0.5 block text-[13px] leading-[1.15rem] text-muted-foreground">
            {detail}
          </span>
        ) : null}
        {status ? <span className="mt-1 block">{status}</span> : null}
      </span>
      {value ? (
        <span className="max-w-[46%] shrink-0 text-right text-[15px] leading-5 text-muted-foreground tabular-nums">
          {value}
        </span>
      ) : null}
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
      {href || onClick ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
      ) : null}
    </>
  );
  const rowClassName = cn(
    "ios-grouped-row focus-aaa flex min-h-14 w-full min-w-0 touch-manipulation items-center gap-3 px-4 py-2.5 text-left outline-none",
    (href || onClick) &&
      "transition-colors duration-100 active:bg-secondary motion-reduce:transition-none",
    className,
  );

  if (href) {
    return (
      <Link href={href} prefetch aria-label={ariaLabel} className={rowClassName}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={rowClassName}>
        {content}
      </button>
    );
  }

  return <div className={rowClassName}>{content}</div>;
}

export function IOSMetricRow({
  label,
  value,
  detail,
  tone,
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Parameters<typeof IOSInlineStatus>[0]["tone"];
  href?: string;
  className?: string;
}) {
  return (
    <IOSListRow
      label={label}
      value={value}
      detail={detail}
      href={href}
      className={className}
      status={tone ? <IOSInlineStatus label={toneLabel(tone)} tone={tone} /> : undefined}
    />
  );
}

export type IOSDisclosureItem = {
  value: string;
  title: ReactNode;
  summary?: ReactNode;
  description?: ReactNode;
  content: ReactNode;
  defaultOpen?: boolean;
  contentClassName?: string;
};

export function IOSDisclosureGroup({
  items,
  defaultValue,
  label,
  className,
}: {
  items: IOSDisclosureItem[];
  defaultValue?: string;
  label?: string;
  className?: string;
}) {
  const resolvedDefault = defaultValue ?? items.find((item) => item.defaultOpen)?.value;

  if (items.length === 0) {
    return null;
  }

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={resolvedDefault}
      aria-label={label}
      data-ios-disclosure-group
      className={cn("ios-grouped-list min-w-0 overflow-hidden", className)}
    >
      {items.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          className="ios-grouped-row overflow-hidden border-0"
        >
          <AccordionTrigger className="min-h-14 w-full px-4 py-2.5 text-left no-underline hover:no-underline">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium leading-5 text-foreground">
                {item.title}
              </span>
              {item.description ? (
                <span className="mt-0.5 block text-[13px] font-normal leading-[1.15rem] text-muted-foreground">
                  {item.description}
                </span>
              ) : null}
            </span>
            {item.summary ? (
              <span className="ml-auto max-w-[42%] shrink-0 text-right text-[15px] font-normal leading-5 text-muted-foreground tabular-nums">
                {item.summary}
              </span>
            ) : null}
          </AccordionTrigger>
          <AccordionContent
            className={cn(
              "border-t border-border/70 bg-secondary/35 px-4 pb-4 pt-3",
              item.contentClassName,
            )}
          >
            {item.content}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function toneLabel(tone: NonNullable<Parameters<typeof IOSInlineStatus>[0]["tone"]>) {
  if (tone === "positive") return "On track";
  if (tone === "attention") return "Needs attention";
  if (tone === "critical") return "Action required";
  if (tone === "info") return "Current";
  return "Status";
}
