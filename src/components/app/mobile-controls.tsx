"use client";

import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MobileControlOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

/** Radio choices activate as focus moves; page tabs wait for Space/Enter to avoid unwanted navigation. */
function moveControlFocus(event: KeyboardEvent<HTMLDivElement>, role: "radio" | "tab") {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
  const vertical = role === "radio" && (event.key === "ArrowUp" || event.key === "ArrowDown");
  if (!horizontal && !vertical && event.key !== "Home" && event.key !== "End") return;
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(`button[role="${role}"]`),
  ).filter((button) => !button.disabled);
  const current = buttons.indexOf(event.target as HTMLButtonElement);
  if (current < 0 || !buttons.length) return;
  const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
  const forward = horizontal ? (event.key === "ArrowRight") !== rtl : event.key === "ArrowDown";
  const index =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : (current + (forward ? 1 : -1) + buttons.length) % buttons.length;
  event.preventDefault();
  event.stopPropagation();
  const next = buttons[index];
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (role === "radio" && next.getAttribute("aria-checked") !== "true") next.click();
}

function controlTabStop(options: MobileControlOption[], value: string) {
  return (
    options.find((option) => option.value === value && !option.disabled)?.value ??
    options.find((option) => !option.disabled)?.value
  );
}

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
  const optionCount = Math.max(options.length, 1);
  const tabStop = controlTabStop(options, value);
  const activeIndex = options.findIndex((option) => option.value === value);

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-mobile-control="segmented"
      onKeyDown={(event) => moveControlFocus(event, "radio")}
      className={cn(
        "relative isolate grid min-w-0 gap-1 rounded-[var(--mobile-radius-md)] bg-secondary p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {activeIndex >= 0 ? (
        <span
          className="t-tabs-pill absolute inset-y-1 left-1 z-0 rounded-[calc(var(--mobile-radius-md)-0.25rem)] bg-card shadow-sm ring-1 ring-foreground/5"
          style={{
            width: `calc((100% - 0.5rem - ${(optionCount - 1) * 0.25}rem) / ${optionCount})`,
            transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 0.25}rem))`,
          }}
          aria-hidden="true"
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            tabIndex={option.value === tabStop ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "t-tabs-trigger focus-aaa relative z-10 min-h-11 min-w-0 touch-manipulation rounded-[calc(var(--mobile-radius-md)-0.25rem)] bg-transparent px-2.5 py-2 text-sm font-semibold outline-none disabled:opacity-50",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
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
  const tabStop = controlTabStop(options, value);
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-mobile-control="chips"
      onKeyDown={(event) => moveControlFocus(event, "radio")}
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
            tabIndex={option.value === tabStop ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "focus-aaa min-h-11 shrink-0 snap-start touch-manipulation rounded-[var(--mobile-radius-pill)] border px-3 py-2 text-sm font-semibold outline-none transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50",
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
  href?: string;
  content: ReactNode;
};

export type MobilePageTabsMode = "local" | "navigable";

/**
 * Shared compact pagination for companion carousels. Small sets get directly selectable dots
 * with full touch targets; longer sets keep the centre control to a terse position readout.
 */
export function MobileCarouselPagination({
  labels,
  selectedIndex,
  onSelect,
  ariaLabel,
}: {
  labels: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  ariaLabel: string;
}) {
  if (labels.length === 0) return null;

  if (labels.length > 5) {
    return (
      <p className="text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {selectedIndex + 1} of {labels.length}
      </p>
    );
  }

  return (
    <div role="group" className="flex items-center justify-center gap-2" aria-label={ariaLabel}>
      {labels.map((label, index) => (
        <button
          key={`${label}-${index}`}
          type="button"
          aria-label={`Show ${label}`}
          aria-current={selectedIndex === index ? "step" : undefined}
          onClick={() => onSelect(index)}
          className="grid size-11 place-items-center rounded-full"
        >
          <span
            className={cn(
              "block size-2 rounded-full transition-[background-color,transform] duration-150",
              selectedIndex === index ? "scale-125 bg-primary" : "bg-muted-foreground/35",
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

export function resolveMobilePageTabValue(tabs: MobilePageTab[], currentHref: string) {
  const currentUrl = new URL(currentHref, "http://localhost");
  const candidates = tabs.flatMap((tab) => {
    if (tab.disabled || !tab.href) return [];

    const url = new URL(tab.href, currentUrl);
    return [{ tab, url }];
  });
  const exactMatch = candidates.find(
    ({ url }) =>
      url.pathname === currentUrl.pathname &&
      url.search === currentUrl.search &&
      url.hash === currentUrl.hash,
  );

  if (exactMatch) return exactMatch.tab.value;

  if (currentUrl.hash) {
    const hashMatch = candidates.find(
      ({ url }) => url.pathname === currentUrl.pathname && url.hash === currentUrl.hash,
    );

    if (hashMatch) return hashMatch.tab.value;
  }

  const queryMatch = candidates
    .filter(({ url }) => {
      if (url.pathname !== currentUrl.pathname || url.searchParams.size === 0) return false;

      return [...url.searchParams].every(
        ([key, candidateValue]) => currentUrl.searchParams.get(key) === candidateValue,
      );
    })
    .sort((left, right) => right.url.searchParams.size - left.url.searchParams.size)[0];

  return queryMatch?.tab.value ?? null;
}

/**
 * Meaningful sections within one companion destination. Local mode keeps presentation state out
 * of the URL. Navigable mode creates browser-history entries and restores the matching panel on
 * Back/Forward without reloading the document.
 */
export function MobilePageTabs({
  initialValue,
  tabs,
  ariaLabel,
  className,
  mode = "navigable",
}: {
  initialValue: string;
  tabs: MobilePageTab[];
  ariaLabel: string;
  className?: string;
  mode?: MobilePageTabsMode;
}) {
  const [value, setValue] = useState(initialValue);
  const panelId = useId();
  const selected =
    tabs.find((tab) => tab.value === value && !tab.disabled) ?? tabs.find((tab) => !tab.disabled);

  useEffect(() => {
    if (mode !== "navigable") return;

    const syncValueFromUrl = () => {
      const urlValue = resolveMobilePageTabValue(tabs, window.location.href);
      setValue(urlValue ?? initialValue);
    };

    syncValueFromUrl();
    window.addEventListener("popstate", syncValueFromUrl);

    return () => window.removeEventListener("popstate", syncValueFromUrl);
  }, [initialValue, mode, tabs]);

  if (!selected) return null;

  return (
    <div className={cn("grid gap-4", className)} data-mobile-page-tabs>
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={(event) => moveControlFocus(event, "tab")}
        className="flex min-w-0 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const active = tab.value === selected.value;

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`${panelId}-mobile-tab-${tab.value}`}
              tabIndex={active ? 0 : -1}
              aria-selected={active}
              aria-controls={`${panelId}-mobile-tab-panel-${tab.value}`}
              disabled={tab.disabled}
              onClick={() => {
                setValue(tab.value);
                if (mode === "navigable" && tab.href) {
                  window.history.pushState(window.history.state, "", tab.href);
                }
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
      {tabs.map((tab) => (
        <div
          key={tab.value}
          id={`${panelId}-mobile-tab-panel-${tab.value}`}
          role="tabpanel"
          aria-labelledby={`${panelId}-mobile-tab-${tab.value}`}
          tabIndex={tab.value === selected.value ? 0 : -1}
          hidden={tab.value !== selected.value}
          className="min-w-0 outline-none"
        >
          {tab.value === selected.value ? tab.content : null}
        </div>
      ))}
      <span className="sr-only" aria-live="polite">
        {String(selected.label)} selected
      </span>
    </div>
  );
}
