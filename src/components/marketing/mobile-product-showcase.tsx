import { ArrowRight, Download, ListChecks, Plus, Search } from "lucide-react";

import styles from "./marketing.module.css";

export function MobileProductShowcase() {
  return (
    <section className={styles.mobileShowcase} aria-labelledby="mobile-showcase-title">
      <div>
        <p className={styles.eyebrow}>Built for the range and the course</p>
        <h2 id="mobile-showcase-title">A mobile golf workspace, not a shrunk desktop screen.</h2>
        <p>
          Today, Practice, Play, Sessions and More keep the important routes familiar. Import,
          planning and course preparation stay one action away.
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
          <span>Play</span>
          <span>Sessions</span>
          <span>
            <Plus className="size-4" /> More
          </span>
        </div>
      </div>
    </section>
  );
}
