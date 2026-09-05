"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { MobileTrainingChart, trainingDisplayDate } from "./mobile-training-chart";
import { selectTrainingRangeData } from "@/lib/training/rangeSelection";
import {
  TRAINING_RANGE_OPTIONS,
  normalizeTrainingRange,
  type TrainingRangeKey,
} from "@/lib/training/ranges";
import { mobileTrainingConsistency } from "@/lib/mobile-progress-story";
import type { TrainingOverTimeData } from "@/lib/training/trainingData";
import styles from "./mobile-training.module.css";

export function MobileTrainingLoad({
  data,
  initialRange,
  sourceLinks = {},
}: {
  data: TrainingOverTimeData;
  initialRange: TrainingRangeKey;
  sourceLinks?: Record<string, { href: string; label: string }>;
}) {
  const query = useSearchParams();
  const range = normalizeTrainingRange(query.get("range") ?? initialRange);
  const view = selectTrainingRangeData(data, range);
  const history = view.sessions.filter((row) => row.sessionDate <= data.today);
  const consistency = mobileTrainingConsistency(data.sessionMarkers, data.today);
  const [showAll, setShowAll] = useState(false);
  const quiet = consistency.daysSince !== null && consistency.daysSince > 7;
  function changeRange(value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("range", value);
    const state = { ...window.history.state };
    delete state.__NA;
    delete state._N;
    window.history.replaceState(state, "", url);
    setShowAll(false);
  }
  return (
    <div className={styles.screen} data-mobile-training-load>
      <MobileLargeTitle title="Training" eyebrow="Your golf, over time" />
      <MobileSegmentedControl
        ariaLabel="Training period"
        value={range}
        options={TRAINING_RANGE_OPTIONS.map((item) => ({ value: item.key, label: item.label }))}
        onValueChange={changeRange}
      />
      {data.hasTrainingData ? (
        <>
          <MobileTrainingChart data={view.series} inspect />
          <section className={styles.briefing} aria-label="Training guidance">
            <h2>{quiet ? "A quiet training record" : data.status.label}</h2>
            <p>
              {quiet
                ? "Log any missing practice before using this trend to plan your next session."
                : data.status.advice}
            </p>
            <p className={styles.secondary}>
              {consistency.last ? `Last logged ${trainingDisplayDate(consistency.last)} · ` : ""}
              {data.confidence.label}
            </p>
            <Link href="/practice" className={styles.action}>
              Plan your next practice <span aria-hidden>›</span>
            </Link>
          </section>
          <details className={styles.evidence}>
            <summary>About this training model</summary>
            <p>{data.confidence.detail}</p>
            <p>
              Fitness follows logged golf workload over {data.conditioningDays} days. Recent load
              reflects short-term demand. Golf form uses the existing comparable-session model; it
              is not a physical-readiness test.
            </p>
            <p>
              Missing activity can make load look lower. Completing a practice plan records
              activity; measured shots establish performance.
            </p>
          </details>
        </>
      ) : (
        <section className={styles.briefing}>
          <h2>Build your training history</h2>
          <p>Recorded practice and rounds will establish your load and golf-form trends.</p>
          <Link href="/practice" className={styles.action}>
            Start a practice <span aria-hidden>›</span>
          </Link>
        </section>
      )}
      <MobileSection title="Training in this period">
        <p className={styles.secondary}>
          {history.length} {history.length === 1 ? "session" : "sessions"} ·{" "}
          {new Set(history.map((row) => row.sessionDate)).size} logged days
        </p>
        {history.length ? (
          <div className={styles.history}>
            {(showAll ? history : history.slice(0, 12)).map((session) => {
              const link = session.sourceId ? sourceLinks[session.sourceId] : undefined;
              return (
                <details key={session.id} className={styles.session}>
                  <summary>
                    <span>
                      <strong>{session.title}</strong>
                      <span>
                        {trainingDisplayDate(session.sessionDate)}
                        {session.durationMinutes !== null
                          ? ` · ${session.durationMinutes} min`
                          : ""}
                      </span>
                    </span>
                    <span className={styles.load}>
                      <strong>{Math.round(session.sessionLoad)}</strong>
                      <span>load</span>
                    </span>
                  </summary>
                  <dl>
                    <div>
                      <dt>Recorded effort</dt>
                      <dd>{session.rpe} / 10</dd>
                    </div>
                    {session.holesPlayed !== null ? (
                      <div>
                        <dt>Holes</dt>
                        <dd>{session.holesPlayed}</dd>
                      </div>
                    ) : null}
                    {session.totalSwings !== null ? (
                      <div>
                        <dt>Recorded swings</dt>
                        <dd>{session.totalSwings}</dd>
                      </div>
                    ) : null}
                    {session.walked !== null || session.usedCart !== null ? (
                      <div>
                        <dt>On course</dt>
                        <dd>
                          {session.walked ? "Walked" : session.usedCart ? "Cart" : "Not specified"}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {session.notes ? <p className={styles.note}>{session.notes}</p> : null}
                  {link ? (
                    <Link href={link.href} className={styles.action}>
                      {link.label}
                      <span aria-hidden>›</span>
                    </Link>
                  ) : session.sourceType === "practice" ? (
                    <Link href="/practice" className={styles.action}>
                      Open Practice<span aria-hidden>›</span>
                    </Link>
                  ) : null}
                </details>
              );
            })}
            {history.length > 12 ? (
              <button type="button" className={styles.action} onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show recent sessions" : `Show all ${history.length} sessions`}
              </button>
            ) : null}
          </div>
        ) : (
          <p className={styles.secondary}>
            No sessions were logged in this period. Choose a longer period to see earlier activity.
          </p>
        )}
      </MobileSection>
      <MobileGroupedList>
        <MobileListRow label="Progress" detail="Performance, scoring and goals" href="/progress" />
      </MobileGroupedList>
    </div>
  );
}
