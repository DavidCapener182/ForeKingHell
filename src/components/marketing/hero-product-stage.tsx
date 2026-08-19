import { ArrowRight, CheckCircle2, MapPinned, ShieldCheck, Target } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { marketingJoinBetaHref } from "@/lib/marketing-links";

import styles from "./marketing.module.css";
import { ScrollZoomFrame } from "./scroll-zoom-frame";

export function HeroProductStage() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>Launch-monitor golf, turned into decisions</p>
        <h1 id="hero-title">Turn every measured shot into a better golf game.</h1>
        <p className={styles.heroLead}>
          Import your sessions, trust your club numbers, understand what changed, practise the right
          thing and take a data-backed plan to the course.
        </p>
        <div className={styles.heroActions}>
          <Button asChild className={styles.heroPrimary}>
            <Link href={marketingJoinBetaHref}>
              Join the beta <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" className={styles.heroSecondary}>
            <a href="#sample-tour">Explore the sample tour</a>
          </Button>
        </div>
        <Link className={styles.existingUserLink} href="/login">
          Existing user? Sign in
        </Link>
        <p className={styles.heroFootnote}>
          Built around measured evidence. Demo data is clearly labelled.
        </p>
      </div>

      <ScrollZoomFrame
        className={styles.productStage}
        aria-label="Example LM World Tour product screens using demo data"
        data-composited-scroll-zoom
      >
        <Image
          className={styles.stageRangeImage}
          src="/assets/generated/lmwt-range-hero.png"
          alt="Golfer using a launch monitor on a golf range at dusk"
          fill
          preload
          sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 850px) 100vw, 56vw"
        />
        <div className={styles.stageRangeShade} aria-hidden />
        <div className={styles.stageBackdrop} aria-hidden />
        <article className={`${styles.demoPanel} ${styles.verdictPanel}`}>
          <span className={styles.panelEyebrow}>Latest session · Demo data</span>
          <div className={styles.verdictHeader}>
            <div>
              <p className={styles.verdictLabel}>Verdict</p>
              <strong>Driver start line needs attention</strong>
            </div>
            <span className={styles.signalMixed}>Mixed evidence</span>
          </div>
          <div className={styles.sparkBars} aria-hidden>
            {[38, 62, 52, 76, 58, 68, 45, 70].map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <p>Carry held. Direction shifted 6 yd right across the clean sample.</p>
        </article>

        <article className={`${styles.demoPanel} ${styles.dispersionPanel}`}>
          <span className={styles.panelEyebrow}>Driver dispersion</span>
          <div className={styles.dispersionField} aria-hidden>
            <span className={styles.fairwayLine} />
            {[
              [18, 28],
              [32, 41],
              [41, 23],
              [50, 52],
              [57, 35],
              [66, 46],
              [72, 29],
              [77, 61],
            ].map(([top, left], index) => (
              <i key={index} style={{ top: `${top}%`, left: `${left}%` }} />
            ))}
            <b>+6 yd</b>
          </div>
          <p>Common pattern: right of target.</p>
        </article>

        <article className={`${styles.demoPanel} ${styles.bagPanel}`}>
          <span className={styles.panelEyebrow}>Trusted bag carry</span>
          <div className={styles.bagMetric}>
            <strong>242</strong>
            <span>yd</span>
          </div>
          <div className={styles.confidenceRow}>
            <ShieldCheck className="size-4" /> High confidence · 46 shots
          </div>
        </article>

        <article className={`${styles.demoPanel} ${styles.practicePanel}`}>
          <div className={styles.practiceIcon}>
            <Target className="size-4" />
          </div>
          <div>
            <span className={styles.panelEyebrow}>Recommended practice</span>
            <strong>30 min · start-line window</strong>
          </div>
          <CheckCircle2 className={styles.checkIcon} aria-hidden />
        </article>

        <article className={`${styles.demoPanel} ${styles.coursePanel}`}>
          <div className={styles.courseMap} aria-hidden>
            <span />
            <i />
            <b />
          </div>
          <div>
            <span className={styles.panelEyebrow}>Course Twin · Pilot</span>
            <strong>3 Wood to safe target</strong>
            <p>Expected carry 214–224 yd</p>
          </div>
          <MapPinned className="size-5" aria-hidden />
        </article>

        <div className={styles.mobileStageRail} aria-label="Product preview rail">
          <span>Verdict</span>
          <span>Dispersion</span>
          <span>Bag trust</span>
          <span>Practice</span>
          <span>Course plan</span>
        </div>
      </ScrollZoomFrame>

      <div className={styles.mobileStickyCtaDock} data-mobile-sticky-cta>
        <Button asChild className={styles.mobileStickyCtaButton}>
          <Link href={marketingJoinBetaHref}>
            Join the beta <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}
