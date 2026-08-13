import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ResultHero({
  eyebrow = "Complete",
  title,
  summary,
  confidence,
  metrics = [],
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  summary?: React.ReactNode;
  confidence?: { label: string; tone?: "default" | "secondary" | "destructive" | "outline" };
  metrics?: { label: string; value: React.ReactNode }[];
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-4 rounded-2xl border border-primary/20 bg-card p-5 shadow-xs",
        className,
      )}
      data-result-hero
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <CheckCircle2 className="size-4" aria-hidden />
            {eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-7 tracking-tight">{title}</h1>
        </div>
        {confidence ? (
          <Badge variant={confidence.tone ?? "secondary"} className="shrink-0">
            {confidence.label}
          </Badge>
        ) : null}
      </div>
      {summary ? <div className="text-sm leading-6 text-muted-foreground">{summary}</div> : null}
      {metrics.length ? (
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border bg-muted/25">
          {metrics.slice(0, 4).map((metric) => (
            <div
              key={metric.label}
              className="min-w-0 border-b border-r p-3 even:border-r-0 last:border-b-0"
            >
              <dt className="truncate text-xs text-muted-foreground">{metric.label}</dt>
              <dd className="mt-1 truncate font-semibold">{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {action}
    </section>
  );
}
