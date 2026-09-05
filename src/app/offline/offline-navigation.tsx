"use client";
import { mobilePrimaryItems } from "@/components/app/nav-items";
import styles from "./offline.module.css";

export function OfflineNavigation({
  section,
  onSelect,
}: {
  section: string;
  onSelect: (section: string) => void;
}) {
  return (
    <nav aria-label="Mobile primary — saved content" className={styles.navigation}>
      {mobilePrimaryItems.map(({ href, label, icon: Icon }) => (
        <button
          key={href}
          type="button"
          aria-current={section === href.slice(1) ? "page" : undefined}
          onClick={() => onSelect(href.slice(1))}
        >
          <Icon aria-hidden size={22} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
