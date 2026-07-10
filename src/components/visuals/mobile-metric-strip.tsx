import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StripTone = "green" | "sky" | "amber" | "pink" | "slate";

const dotTone: Record<StripTone, string> = {
  green: "bg-emerald-500 ring-emerald-100",
  sky: "bg-sky-500 ring-sky-100",
  amber: "bg-amber-500 ring-amber-100",
  pink: "bg-pink-500 ring-pink-100",
  slate: "bg-slate-400 ring-slate-200",
};

export function MobileMetricStrip({
  items,
  className,
}: {
  items: Array<{
    label: ReactNode;
    value: ReactNode;
    detail?: ReactNode;
    tone?: StripTone;
  }>;
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Mobile summary metrics"
      tabIndex={0}
      className={cn(
        "ios-grouped-list -mx-4 flex overflow-x-auto px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden",
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={`${String(item.label)}-${index}`}
          className="ios-grouped-row grid min-w-32 shrink-0 grid-cols-[auto_1fr] gap-2.5 border-r px-3.5 py-3"
        >
          <span className={cn("mt-1.5 size-2 rounded-full", dotTone[item.tone ?? "green"])} />
          <span className="min-w-0">
            <span className="block truncate text-xs text-muted-foreground">{item.label}</span>
            <span className="mt-0.5 block truncate text-[17px] font-semibold tabular-nums">
              {item.value}
            </span>
            {item.detail ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {item.detail}
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
