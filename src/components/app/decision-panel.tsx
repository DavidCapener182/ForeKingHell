import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./decision-panel.module.css";

type DecisionPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  action: { label: string; href: string };
  secondaryActions?: Array<{ label: string; href: string }>;
  evidence: ReactNode;
  headingLevel?: 1 | 2;
  compact?: boolean;
  variant?: "default" | "forest";
};

/** One answer, one primary action, and a separately readable evidence column. */
export function DecisionPanel({
  eyebrow,
  title,
  description,
  action,
  secondaryActions = [],
  evidence,
  headingLevel = 1,
  compact = false,
  variant = "default",
}: DecisionPanelProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section
      className={`${styles.panel} ${compact ? styles.compact : ""} ${variant === "forest" ? styles.forest : ""}`}
      aria-label={eyebrow}
    >
      <div className={styles.answer}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <Heading className={styles.title}>{title}</Heading>
        <p className={styles.description}>{description}</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href={action.href} prefetch={false}>
            {action.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          {secondaryActions.map((item) => (
            <Link className={styles.secondary} key={item.href} href={item.href} prefetch={false}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className={styles.evidence} data-decision-evidence>
        {evidence}
      </div>
    </section>
  );
}
