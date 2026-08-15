"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MobileControlOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

/**
 * A local, mutually exclusive view control. Use this for presentation state such as
 * Dispersion/Flight or Carry/Play number. It never performs document navigation.
 */
export function MobileSegmentedControl({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
}: {
  value: string;
  options: MobileControlOption[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-mobile-control="segmented"
      className={cn(
        "grid min-w-0 gap-1 rounded-[var(--mobile-radius-md)] bg-secondary p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "focus-aaa min-h-11 min-w-0 touch-manipulation rounded-[calc(var(--mobile-radius-md)-0.25rem)] px-2.5 py-2 text-sm font-semibold outline-none transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
              selected
                ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/5"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="block truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A single-select set of independent pills. Use this for filters and club choices,
 * never as joined page navigation. Every item keeps four fully rounded corners.
 */
export function MobileFilterChipGroup({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
  scrollable = false,
}: {
  value: string;
  options: MobileControlOption[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  scrollable?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-mobile-control="chips"
      className={cn(
        "flex min-w-0 gap-2",
        scrollable
          ? "-mx-1 snap-x snap-proximity overflow-x-auto overscroll-x-contain px-1 pb-1 pr-5 [scroll-padding-inline:0.25rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex-wrap",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "focus-aaa min-h-11 shrink-0 snap-start touch-manipulation rounded-[var(--mobile-radius-pill)] border px-3 py-2 text-sm font-semibold outline-none transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export type MobilePageTab = MobileControlOption & {
  href: string;
  content: ReactNode;
};

/**
 * Meaningful sections within one companion destination. Content is switched in place and
 * the URL is synchronised with history.replaceState, so the document never reloads.
 */
export function MobilePageTabs({
  initialValue,
  tabs,
  ariaLabel,
  className,
}: {
  initialValue: string;
  tabs: MobilePageTab[];
  ariaLabel: string;
  className?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const panelId = useId();
  const selected = tabs.find((tab) => tab.value === value) ?? tabs[0];

  if (!selected) return null;

  return (
    <div className={cn("grid gap-4", className)} data-mobile-page-tabs>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-0 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const active = tab.value === selected.value;

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${panelId}-mobile-tab-panel-${tab.value}`}
              disabled={tab.disabled}
              onClick={() => {
                setValue(tab.value);
                window.history.replaceState(window.history.state, "", tab.href);
              }}
              className={cn(
                "focus-aaa relative min-h-11 flex-1 shrink-0 touch-manipulation whitespace-nowrap px-3 py-2 text-sm font-semibold outline-none transition-[color,transform] duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
                active ? "text-foreground" : "text-muted-foreground",
                "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:transition-opacity after:duration-150",
                active ? "after:opacity-100" : "after:opacity-0",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${panelId}-mobile-tab-panel-${selected.value}`}
        role="tabpanel"
        tabIndex={0}
        className="min-w-0 outline-none"
      >
        {selected.content}
      </div>
      <span className="sr-only" aria-live="polite">
        {String(selected.label)} selected
      </span>
    </div>
  );
}
