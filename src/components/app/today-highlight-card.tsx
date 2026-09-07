import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { TodayHighlight } from "@/lib/today-highlights";
import styles from "./today-highlight-card.module.css";
export function TodayHighlightCard({ highlight }: { highlight: TodayHighlight }) {
  return (
    <section className={styles.card}>
      <p className={styles.label}>{highlight.label}</p>
      <h2 className={styles.title}>{highlight.title}</h2>
      <p className={styles.value}>{highlight.value}</p>
      <p className={styles.description}>{highlight.description}</p>
      <div className={styles.footer}>
        <p>{highlight.evidence}</p>
        <Link href={highlight.href} prefetch={false}>
          {highlight.action}
          <ArrowUpRight size={18} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
