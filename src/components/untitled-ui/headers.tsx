import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./headers.module.css";

export type HeaderMetric = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
};

export type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  metrics?: HeaderMetric[];
  visual?: ReactNode;
  visualSize?: "compact" | "wide";
  className?: string;
};

/** Local accessible composition of the Untitled UI Simple header reference.
 * One DOM tree keeps all actions, metric evidence and entity names on every viewport.
 * The action slot retains the caller's original form/event contract.
 */
export function UntitledPageHeader({
  eyebrow,
  title,
  description,
  actions,
  metrics,
  visual,
  visualSize = "compact",
  className,
}: PageHeaderProps) {
  return (
    <header data-ui-page-header className={cn(styles.header, className)}>
      <div className={styles.row}>
        <div className={styles.copy}>
          {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
          <h1 className={styles.title}>{title}</h1>
          {description ? <div className={styles.description}>{description}</div> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {visual ? (
        <div data-compact-media data-visual-size={visualSize} className={styles.visual}>
          {visual}
        </div>
      ) : null}
      {metrics?.length ? (
        <dl className={styles.metrics}>
          {metrics.map((metric, index) => (
            <div key={`${metric.label}-${index}`} className={cn(styles.metric, metric.className)}>
              <dt>{metric.label}</dt>
              <dd data-operational-value className={styles.value}>
                {metric.value}
              </dd>
              {metric.detail ? <dd className={styles.detail}>{metric.detail}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}

export function UntitledSectionHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header
      data-ui-section-header
      className={cn(styles.header, "border-b border-border px-4 py-3")}
    >
      <div className={styles.row}>
        <div className={styles.copy}>
          <h2 className={cn(styles.title, styles.sectionTitle)}>{title}</h2>
          {description ? <div className={styles.description}>{description}</div> : null}
        </div>
        {action ? <div className={styles.actions}>{action}</div> : null}
      </div>
    </header>
  );
}
