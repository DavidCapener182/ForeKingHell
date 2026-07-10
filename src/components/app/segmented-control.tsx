"use client";

import { cn } from "@/lib/utils";

export type SegmentedControlOption = {
  label: string;
  value: string;
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
      <div
        className="grid rounded-xl bg-secondary p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "focus-aaa min-h-11 rounded-lg px-3 text-sm font-semibold transition-[background-color,color,box-shadow] motion-reduce:transition-none",
              value === option.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
