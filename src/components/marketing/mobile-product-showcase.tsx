import { ArrowRight, Download, ListChecks, Search } from "lucide-react";

import styles from "./marketing.module.css";

export function MobileProductShowcase() {
  return (
    <section className={styles.mobileShowcase} aria-labelledby="mobile-showcase-title">
      <div>
        <p className={styles.eyebrow}>Built for the range and the course</p>
        <h2 id="mobile-showcase-title">A mobile golf workspace, not a shrunk desktop screen.</h2>
        <p>
          Today, Practice, Strategy, Review and Bag keep the important decisions one tap away.
          Imports and account tools stay available without crowding the companion workflow.
        </p>
        <div className={styles.mobileBullets}>
          <span>
            <Download className="size-4" /> PWA installation where supported
          </span>
          <span>
            <ListChecks className="size-4" /> Latest practice verdict first
          </span>
          <span>
            <Search className="size-4" /> Fast route switching and command search
          </span>
        </div>
      </div>
      <div className={styles.phoneFrame} aria-label="Mobile product structure example">
        <div className={styles.phoneStatus}>
          <span>9:41</span>
          <span>● ● ●</span>
        </div>
        <p className={styles.phoneEyebrow}>Today · Demo data</p>
        <h3>Driver start line</h3>
        <p>Mixed evidence · 46 clean shots</p>
        <div className={styles.phoneCard}>
          <span>Next action</span>
          <strong>30 min start-line practice</strong>
          <ArrowRight className="size-4" />
        </div>
        <div className={styles.phoneNav}>
          <span>Today</span>
          <span>Practice</span>
          <span>Strategy</span>
          <span>Review</span>
          <span>Bag</span>
        </div>
      </div>
    </section>
  );
}
