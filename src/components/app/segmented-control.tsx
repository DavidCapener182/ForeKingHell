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
        className="grid w-full rounded-xl bg-secondary p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        aria-label={label}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              "focus-aaa min-h-11 min-w-0 justify-center rounded-lg border-0 px-3 text-sm font-semibold text-muted-foreground transition-[background-color,color,box-shadow] motion-reduce:transition-none data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
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
