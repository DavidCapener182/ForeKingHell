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
    <div className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:hidden", className)}>
      {items.map((item, index) => (
        <div
          key={`${String(item.label)}-${index}`}
          className="grid min-w-36 shrink-0 grid-cols-[auto_1fr] gap-3 rounded-xl border border-slate-200 bg-white/88 p-3 shadow-sm"
        >
          <span className={cn("mt-1 size-2.5 rounded-full ring-4", dotTone[item.tone ?? "green"])} />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {item.label}
            </span>
            <span className="mt-0.5 block truncate text-lg font-semibold tracking-normal">{item.value}</span>
            {item.detail ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.detail}</span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
