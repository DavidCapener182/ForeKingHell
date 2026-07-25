import Link from "next/link";
import { Database, Eye, FileDown, LockKeyhole, Sparkles } from "lucide-react";

import styles from "./marketing.module.css";

const commitments = [
  [LockKeyhole, "Account-scoped data", "Your golf records are scoped to your account."],
  [
    Database,
    "Traceable evidence",
    "Imported records remain available to review beside derived conclusions.",
  ],
  [Eye, "Visible data health", "Confidence and data-quality warnings stay in the decision flow."],
  [Sparkles, "Read-only Data Chat", "AI can explain your records, not alter them."],
  [
    FileDown,
    "Controls you can review",
    "Visibility, sharing, export and deletion controls are available where implemented.",
  ],
] as const;

export function PrivacyTrustSection() {
  return (
    <section id="privacy" className={styles.privacySection} aria-labelledby="privacy-title">
      <div className={styles.privacyHeading}>
        <p className={styles.eyebrow}>Privacy, AI and data trust</p>
        <h2 id="privacy-title">Every conclusion should show its footing.</h2>
        <p>
          LM World Tour is designed so golf decisions can be inspected: the data source, the
          evidence quality and the boundary around AI remain visible.
        </p>
        <Link href="/privacy">Read the current privacy notice</Link>
      </div>
      <div className={styles.privacyGrid}>
        {commitments.map(([Icon, title, detail]) => (
          <article key={title}>
            <Icon className="size-5" aria-hidden />
            <h3>{title}</h3>
            <p>{detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
