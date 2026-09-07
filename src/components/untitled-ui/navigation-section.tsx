"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./navigation-section.module.css";

/** Section-subheading navigation composition. Icon mode exposes every item. */
export function NavigationSection({
  label,
  activeLabel,
  iconMode,
  children,
}: {
  label: string;
  activeLabel?: string;
  iconMode: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [collapsed, setCollapsed] = useState(false);
  const expanded = iconMode || !collapsed;
  return (
    <>
      <button
        type="button"
        className={styles.heading}
        hidden={iconMode}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setCollapsed((value) => !value)}
      >
        <span>
          {label}
          {collapsed && activeLabel ? <span className={styles.active}>{activeLabel}</span> : null}
        </span>
        <ChevronDown aria-hidden className={styles.chevron} data-expanded={expanded} />
      </button>
      <div id={id} hidden={!expanded}>
        {children}
      </div>
    </>
  );
}
