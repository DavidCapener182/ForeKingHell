import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Content hierarchy shared by companion destinations and pushed screens. */
export function MobileLargeTitle({
  title,
  eyebrow,
  detail,
  action,
}: {
  title: string;
  eyebrow?: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mobile-large-title">
      {eyebrow ? <p className="mobile-type-footnote text-muted-foreground">{eyebrow}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <h1 data-mobile-route-label>{title}</h1>
        {action}
      </div>
      {detail ? <p className="mobile-type-callout text-muted-foreground">{detail}</p> : null}
    </header>
  );
}

export function MobileSection({
  title,
  children,
  action,
  id,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mobile-section" aria-label={title}>
      <header className="mobile-section-heading">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function MobileMetric({
  value,
  unit,
  label,
  detail,
  className,
}: {
  value: ReactNode;
  unit?: string;
  label: string;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mobile-metric", className)}>
      <p className="mobile-metric-value">{value}</p>
      <p className="mobile-type-subheadline">
        {unit ? `${unit} ` : ""}
        {label}
      </p>
      {detail ? <p className="mobile-type-footnote text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
