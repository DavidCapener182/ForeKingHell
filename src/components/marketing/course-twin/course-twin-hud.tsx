"use client";

import type { MarketingCourseTwinClub, MarketingShotPlan } from "./course-twin-types";
import styles from "./course-twin.module.css";

export function CourseTwinHud({
  club,
  plan,
  status,
  onClubChange,
  onReplay,
}: {
  club: MarketingCourseTwinClub;
  plan: MarketingShotPlan;
  status: string;
  onClubChange: (club: MarketingCourseTwinClub) => void;
  onReplay: () => void;
}) {
  return (
    <div className={styles.hud} aria-label="Course Twin shot planning controls">
      <div className={styles.hudPrimaryRow}>
        <fieldset className={styles.clubFieldset}>
          <legend>Planned club</legend>
          <div className={styles.segmentedControl} aria-label="Choose planned club">
            {(
              [
                ["three-wood", "3 Wood"],
                ["driver", "Driver"],
              ] as const
            ).map(([value, label]) => {
              const selected = club === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  data-selected={selected}
                  onClick={() => onClubChange(value)}
                >
                  <span className={styles.selectionMark} aria-hidden>
                    {selected ? "✓" : ""}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button type="button" className={styles.replayButton} onClick={onReplay}>
          <span aria-hidden>↻</span>
          Replay shot plan
        </button>
      </div>

      <dl className={styles.metrics}>
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
        <div>
          <dt>Plan basis</dt>
          <dd>Mapped hole · reconstructed terrain</dd>
        </div>
      </dl>

      <p id="course-twin-plan-description" className={styles.planDisclosure}>
        Expected carry, target and miss are modelled planning guidance. Measured launch-monitor
        evidence remains separate from this reconstructed course view.
      </p>
      <p className={styles.liveStatus} aria-live="polite" aria-atomic="true">
        {status}
      </p>
    </div>
  );
}
