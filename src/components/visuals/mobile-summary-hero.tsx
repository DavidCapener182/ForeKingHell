import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileSummaryHero({
  eyebrow,
  title,
  description,
  metricLabel,
  metricValue,
  action,
  visual,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  metricLabel: ReactNode;
  metricValue: ReactNode;
  action?: ReactNode;
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("premium-card grid gap-3 p-3 sm:hidden", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
          <h2 className="text-xl font-semibold leading-tight tracking-normal text-balance">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {visual ? <div className="w-20 shrink-0">{visual}</div> : null}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{metricLabel}</p>
          <p className="mt-1 text-2xl font-semibold tracking-normal">{metricValue}</p>
        </div>
        {action ? <div className="[&_[data-slot=button]]:min-h-11">{action}</div> : null}
      </div>
    </section>
  );
}

export function MobileSummaryAction({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button asChild className={cn("rounded-lg bg-[#111827] text-white", className)}>
      {children}
    </Button>
  );
}
