"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Medal, PartyPopper, Target, Trophy } from "lucide-react";
import { BENCHMARK_REFERENCE_VERSION, type ClubBenchmarkRow } from "@/lib/club-benchmarks";
import { nearestBenchmarkUnlocks } from "@/lib/benchmark-milestones";
import { formatClubType } from "@/lib/club-format";
import styles from "./benchmark-unlocks.module.css";

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

export function BenchmarkUnlocks({ rows }: { rows: ClubBenchmarkRow[] }) {
  const [celebration, setCelebration] = useState(0);
  const milestones = rows
    .flatMap((row) => (row.milestones ?? []).map((milestone) => ({ ...milestone, row })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = milestones[0];
  const targets = nearestBenchmarkUnlocks(rows).slice(0, 3);
  if (!targets.length && !latest) return null;

  return (
    <section aria-label="Benchmark unlocks" className={styles.root}>
      {latest && (
        <div className={styles.hero}>
          <div className={styles.medal}>
            <Trophy size={32} aria-hidden="true" />
          </div>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              Latest benchmark unlocked · {date.format(new Date(latest.date))}
            </p>
            <h3>
              {formatClubType(latest.row.clubType)} reached {latest.to}
            </h3>
            <p>
              {latest.from} → {latest.to} · {number.format(latest.carryYd)} yd best-
              {Math.min(30, latest.sampleSize)} average · {latest.sampleSize} shots used ·{" "}
              {latest.confirmed ? "Confirmed sample" : "Provisional sample"} ·{" "}
              {latest.referenceVersion ?? BENCHMARK_REFERENCE_VERSION}
            </p>
            <Link href={`/sessions/${latest.sessionId}`}>
              View the session behind it <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <button
            type="button"
            className={styles.celebrate}
            onClick={() => setCelebration((value) => value + 1)}
          >
            <PartyPopper size={17} aria-hidden="true" /> Celebrate
          </button>
          {celebration > 0 && (
            <span key={celebration} className={styles.confetti} aria-hidden="true">
              {Array.from({ length: 18 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${5 + i * 5}%`,
                    animationDelay: `${(i % 5) * 0.06}s`,
                    background: ["#dbeaa4", "#eec77d", "#ffffff"][i % 3],
                  }}
                />
              ))}
            </span>
          )}
          <span className="sr-only" role="status">
            {celebration > 0
              ? `${formatClubType(latest.row.clubType)} ${latest.to} benchmark unlocked. Well played!`
              : ""}
          </span>
        </div>
      )}

      {targets.length > 0 && (
        <div className={styles.targets}>
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>Keep the progress going</p>
              <h3>
                <Target size={20} aria-hidden="true" /> Closest next unlocks
              </h3>
            </div>
            <p>Ranked by progress through your current carry band.</p>
          </div>
          <div className={styles.grid}>
            {targets.map(({ row, target, progress, gap }, index) => (
              <article key={row.clubId} className={styles.target}>
                <div className={styles.targetTop}>
                  <span>{index === 0 ? "NEAREST UNLOCK" : `NEXT UP · ${index + 1}`}</span>
                  <Medal size={22} aria-hidden="true" />
                </div>
                <h4>
                  {formatClubType(row.clubType)} <span>→ {target.label}</span>
                </h4>
                <div className={styles.gap}>
                  {number.format(gap)} <span>yd to unlock</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${formatClubType(row.clubType)} progress to ${target.label}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                  aria-valuetext={`${number.format(row.carryYd!)} of ${target.yards} yards; ${number.format(gap)} yards remaining`}
                  className={styles.bar}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className={styles.readout}>
                  <span>
                    {number.format(row.carryYd!)} yd best-{Math.min(30, row.sampleSize)} avg
                  </span>
                  <strong>{target.yards} yd target</strong>
                </div>
                <p className={styles.plan}>
                  The selected average must reach {target.yards} yd; individual shots need not all
                  exceed it. {row.sampleSize < 30 ? "Provisional best-N sample. " : ""}
                  {BENCHMARK_REFERENCE_VERSION}.
                </p>
                <Link href={`/bag/${row.clubId}`}>
                  Open {formatClubType(row.clubType)} <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      )}

      {milestones.length > 0 && (
        <details className={styles.history}>
          <summary>
            <Trophy size={16} aria-hidden="true" /> Your level-ups <span>{milestones.length}</span>
          </summary>
          <p>
            Reconstructed benchmark history from the shots in this review; older history outside the
            review may not appear. This view can change after corrections. Earned achievements
            retain their original award evidence and XP.
          </p>
          <div className={styles.historyGrid}>
            {milestones.map((milestone) => (
              <Link
                key={`${milestone.row.clubId}:${milestone.id}`}
                href={`/sessions/${milestone.sessionId}`}
              >
                <Medal size={20} aria-hidden="true" />
                <span>
                  <strong>
                    {formatClubType(milestone.row.clubType)} · {milestone.to}
                  </strong>
                  <small>
                    {milestone.from} → {milestone.to} · {date.format(new Date(milestone.date))}
                  </small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
