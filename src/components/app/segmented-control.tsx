"use client";

import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type SegmentedControlOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

export function SegmentedControl({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: SegmentedControlOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const optionCount = Math.max(options.length, 1);
  const activeIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) onChange(nextValue);
        }}
        variant="outline"
        spacing={0}
        className="relative isolate grid w-full rounded-xl bg-secondary p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        aria-label={label}
      >
        <span
          className="t-tabs-pill absolute inset-y-1 left-1 z-0 rounded-lg bg-card shadow-sm"
          style={{
            width: `calc((100% - 0.5rem) / ${optionCount})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
          aria-hidden="true"
        />
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              "t-tabs-trigger focus-aaa relative z-10 min-h-11 min-w-0 justify-center rounded-lg border-0 bg-transparent px-3 text-sm font-semibold text-muted-foreground data-[state=on]:bg-transparent data-[state=on]:text-foreground data-[state=on]:shadow-none",
              option.disabled && "cursor-not-allowed text-muted-foreground/50",
            )}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
