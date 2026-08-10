import { SHOT_PLANS } from "./course-twin-data";
import styles from "./course-twin.module.css";

export type CourseTwinFallbackMode =
  | "approaching"
  | "checking"
  | "loading"
  | "reduced-motion"
  | "data-saving"
  | "unsupported"
  | "runtime-error";

const fallbackMessages: Record<CourseTwinFallbackMode, string> = {
  approaching: "Interactive course view loads as this section approaches",
  checking: "Checking graphics support…",
  loading: "Loading the interactive course view…",
  "reduced-motion": "Completed plan shown with motion reduced",
  "data-saving": "Data-saving course preview",
  unsupported: "Static course plan · WebGL unavailable",
  "runtime-error": "Static course plan · interactive view unavailable",
};

export function CourseTwinStaticFallback({ mode }: { mode: CourseTwinFallbackMode }) {
  const plan = SHOT_PLANS["three-wood"];
  return (
    <div className={styles.fallbackShell} data-course-twin-fallback data-fallback-mode={mode}>
      <div
        className={styles.fallbackMap}
        role="img"
        aria-label="Mapped golf hole plan showing a 3 Wood route to the left-centre fairway, a safe target, right-side common miss, bunkers, water and the green"
      >
        <picture className={styles.fallbackPicture}>
          <source
            media="(max-width: 767px)"
            srcSet="/assets/generated/course-twin-premium-mobile.avif"
            type="image/avif"
          />
          <source
            media="(max-width: 767px)"
            srcSet="/assets/generated/course-twin-premium-mobile.webp"
            type="image/webp"
          />
          <source srcSet="/assets/generated/course-twin-premium-desktop.avif" type="image/avif" />
          <img
            className={styles.fallbackImage}
            src="/assets/generated/course-twin-premium-desktop.webp"
            alt=""
            width="1600"
            height="1080"
            loading="lazy"
            decoding="async"
          />
        </picture>
        <span className={styles.fallbackShade} aria-hidden />
        <div className={styles.fallbackBadges} aria-hidden>
          <span>Reconstructed terrain</span>
          <span>Modelled shot plan</span>
        </div>
        <div className={styles.fallbackLegend} aria-hidden>
          <span data-kind="target">Safe target</span>
          <span data-kind="miss">Common miss</span>
        </div>
      </div>
      <div className={styles.fallbackDetails}>
        <dl className={styles.fallbackMetrics}>
          <div>
            <dt>Planned club</dt>
            <dd>{plan.label}</dd>
          </div>
          <div>
            <dt>Expected carry (modelled)</dt>
            <dd>{plan.expectedCarry}</dd>
          </div>
          <div>
            <dt>Safe target (modelled)</dt>
            <dd>{plan.targetLabel}</dd>
          </div>
          <div>
            <dt>Common miss (modelled)</dt>
            <dd>{plan.missLabel}</dd>
          </div>
          <div>
            <dt>Trajectory (modelled)</dt>
            <dd>{plan.trajectoryLabel}</dd>
          </div>
        </dl>
        <p className={styles.fallbackStatus}>{fallbackMessages[mode]}</p>
      </div>
    </div>
  );
}
