import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Flag, Target } from "lucide-react";
import type { TodayRound } from "@/lib/today-round-data";
import { summarizeTodayRound } from "@/lib/today-round-summary";
import styles from "./today-round-view.module.css";

const relativeScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : String(n));

/** The latest round leads Today; the normal practice and planning sections follow it. */
export function TodayRoundView({ round }: { round: TodayRound }) {
  const s = summarizeTodayRound(round);
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(round.session.date);
  const nines = [
    s.played.filter((h) => h.holeNumber <= 9),
    s.played.filter((h) => h.holeNumber > 9),
  ];
  const frontToPar = nines[0].reduce((n, h) => n + h.score! - h.par, 0);
  const backToPar = nines[1].reduce((n, h) => n + h.score! - h.par, 0);
  const improvement = frontToPar - backToPar;
  const completeNines = nines.every((nine) => nine.length === 9);
  const threePutts = s.putts === null ? null : s.played.filter((h) => h.putts! >= 3).length;
  const metrics = [
    {
      label: "Putts",
      value: s.putts,
      detail: threePutts === null ? "" : `${threePutts} three-putt holes`,
    },
    {
      label: "Fairways",
      value: s.fairways.recorded ? `${s.fairways.hit}/${s.fairways.recorded}` : null,
      detail: s.fairways.recorded
        ? `${Math.round((s.fairways.hit / s.fairways.recorded) * 100)}% of recorded holes`
        : "",
    },
    {
      label: "Greens in regulation",
      value: s.greens.recorded ? `${s.greens.hit}/${s.greens.recorded}` : null,
      detail: s.greens.recorded
        ? `${Math.round((s.greens.hit / s.greens.recorded) * 100)}% of recorded holes`
        : "",
    },
    { label: "Penalties", value: s.penalties, detail: "Penalty strokes" },
  ].filter((m) => m.value !== null);
  const distribution = [
    { label: "Birdie or better", value: s.birdies, tone: "birdie" },
    { label: "Par", value: s.pars, tone: "par" },
    { label: "Bogey", value: s.bogeys, tone: "bogey" },
    { label: "Double+", value: s.doubles, tone: "double" },
  ];
  return (
    <section data-today-round className={styles.round} aria-labelledby="today-round-title">
      <div className={styles.hero}>
        <div className={styles.intro}>
          <div className={styles.eyebrow}>
            <Flag size={14} aria-hidden /> Latest round <span>· {date}</span>
          </div>
          <h2 id="today-round-title">
            {round.session.courseName ?? round.session.location ?? "Your latest round"}
          </h2>
          <p className={styles.course}>
            {round.tee
              ? `${round.tee.name} tees · ${round.tee.yards ? `${round.tee.yards.toLocaleString("en-GB")} yd · ` : ""}`
              : ""}
            {s.played.length} holes · Par {s.par}
          </p>
          <div className={styles.actions}>
            <Link href={`/rounds/${round.session.id}`} className={styles.primaryLink}>
              Review round <ArrowUpRight size={16} aria-hidden />
            </Link>
            <a href="#today-practice-review" className={styles.secondaryLink}>
              Practice & progress <ArrowDownRight size={16} aria-hidden />
            </a>
          </div>
        </div>
        <div className={styles.result}>
          <div className={styles.gross}>
            <span className={styles.scoreLabel}>Gross score</span>
            <div>
              <strong>{s.gross}</strong>
              <span className={styles.toPar}>{relativeScore(s.toPar)}</span>
            </div>
          </div>
          <dl className={styles.splits}>
            <div>
              <dt>Out</dt>
              <dd>{s.front}</dd>
            </div>
            {nines[1].length ? (
              <div>
                <dt>Back</dt>
                <dd>{s.back}</dd>
              </div>
            ) : null}
            {s.net !== null ? (
              <div>
                <dt>Net</dt>
                <dd>{s.net}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
      {metrics.length ? (
        <dl className={styles.metrics} aria-label="Round statistics">
          {metrics.map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
              <p>{m.detail}</p>
            </div>
          ))}
        </dl>
      ) : null}
      <div className={styles.analysis}>
        <div className={styles.scorecard}>
          <div className={styles.sectionTitle}>
            <h3>Your scorecard</h3>
            <Link href={`/rounds/${round.session.id}`}>
              Full details <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>
          <div className={styles.nines}>
            {nines.map((nine, index) =>
              nine.length ? (
                <table key={index} className={styles.nine}>
                  <caption>
                    {index === 0 ? "Front nine" : "Back nine"}{" "}
                    <span>
                      {index === 0 ? s.front : s.back} ·{" "}
                      {relativeScore(index === 0 ? frontToPar : backToPar)}
                    </span>
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Hole</th>
                      {nine.map((h) => (
                        <th key={h.holeNumber} scope="col">
                          {h.holeNumber}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Par</th>
                      {nine.map((h) => (
                        <td key={h.holeNumber}>{h.par}</td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">Score</th>
                      {nine.map((h) => (
                        <td key={h.holeNumber}>
                          <span
                            className={styles.holeScore}
                            data-result={
                              h.score! < h.par
                                ? "birdie"
                                : h.score === h.par
                                  ? "par"
                                  : h.score === h.par + 1
                                    ? "bogey"
                                    : "double"
                            }
                          >
                            {h.score}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              ) : null,
            )}
          </div>
          <div className={styles.distribution} aria-label="Scoring breakdown">
            {distribution.map((d) => (
              <span key={d.label}>
                <i data-result={d.tone} />
                <strong>{d.value}</strong> {d.label}
              </span>
            ))}
          </div>
        </div>
        <aside className={styles.takeaways} aria-label="Round takeaways">
          <h3>
            <Target size={16} aria-hidden /> Take from this round
          </h3>
          <div>
            <span className={styles.takeawayLabel}>Scoring</span>
            <p>
              {completeNines
                ? improvement > 0
                  ? `${improvement} shots better on the back nine`
                  : improvement < 0
                    ? `${Math.abs(improvement)} shots better on the front nine`
                    : "Same score to par on both nines"
                : `${s.pars + s.birdies} holes at par or better`}
            </p>
            <small>
              {completeNines
                ? `${relativeScore(frontToPar)} out → ${relativeScore(backToPar)} back, against par.`
                : `Across ${s.played.length} scored holes.`}
            </small>
          </div>
          {s.greens.recorded ? (
            <div>
              <span className={styles.takeawayLabel}>Approach play</span>
              <p>{s.greens.hit} greens in regulation</p>
              <small>
                {s.greens.recorded - s.greens.hit} missed greens across {s.greens.recorded} recorded
                holes.
              </small>
            </div>
          ) : null}
          <Link href="/practice">
            Plan next practice <ArrowUpRight size={15} aria-hidden />
          </Link>
        </aside>
      </div>
    </section>
  );
}
