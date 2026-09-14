import Link from "next/link";
import type { TodayPracticeRecapModel } from "@/lib/today-practice-recap";
import styles from "./today-practice-recap.module.css";

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const reading = (value: number | null, unit: string) =>
  value === null ? "Not measured" : `${number.format(value)} ${unit}`;

export function TodayPracticeRecap({
  recap,
  dateKey,
  scope,
}: {
  recap: TodayPracticeRecapModel;
  dateKey: string;
  scope: "day" | "session";
}) {
  if (!recap.recorded) return null;
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).format(new Date(`${dateKey}T12:00:00Z`));
  return (
    <section
      className={styles.recap}
      aria-labelledby="today-practice-recap-title"
      data-today-practice-recap
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>What happened in this practice</p>
          <h2 id="today-practice-recap-title">
            {date} · {scope === "session" ? "Your selected upload" : "Your session in detail"}
          </h2>
        </div>
        <a href="#today-practice-clubs" className={styles.jump}>
          See every club ↓
        </a>
      </header>
      <dl className={styles.totals}>
        {[
          [recap.recorded, "Recorded shots"],
          [recap.included, "Trusted full shots"],
          [recap.clubCount, "Clubs used"],
          [recap.uploads.length, "Uploads"],
        ].map(([value, label]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.highlights} aria-label="Standout measurements from this practice">
        {(
          [
            ["Longest measured carry", recap.longest, "yd"],
            ["Fastest ball", recap.fastest, "mph"],
          ] as const
        ).map(([label, shot, unit]) =>
          shot ? (
            <article key={label}>
              <h3>{label}</h3>
              <p className={styles.value}>{reading(shot.value, unit)}</p>
              <p>
                {shot.club} · {shot.source}
              </p>
              <Link href={`/sessions/${shot.sessionId}`} prefetch={false}>
                {shot.shotNumber !== null ? `Shot ${shot.shotNumber} · open upload` : "Open upload"}{" "}
                ↗
              </Link>
            </article>
          ) : null,
        )}
        {recap.tightest ? (
          <article>
            <h3>Tightest carry grouping</h3>
            <p className={styles.value}>{reading(recap.tightest.spread.value, "yd")}</p>
            <p>
              {recap.tightest.clubLabel} · {recap.tightest.source}
            </p>
            <p>Carry standard deviation · {recap.tightest.spread.count} readings</p>
          </article>
        ) : null}
      </div>
      <p className={styles.note}>
        Measurements below use trusted full shots only. {recap.recorded - recap.included} recorded
        shots sit outside that set, including exclusions and other shot types. Standouts are
        individual readings, not personal best claims.
      </p>
      {recap.mixedSources ? (
        <p className={styles.deviceNote}>
          More than one monitor was used. Club results are separated by device; these are raw
          measurements, without a calibration correction. Uploads can include the same physical
          shot, so recorded shots are not a count of unique swings.{" "}
          <Link href="/equipment/launch-monitors/calibration" prefetch={false}>
            Review device comparison ↗
          </Link>
        </p>
      ) : null}
      <div id="today-practice-clubs" className={styles.clubs}>
        <h3>What you hit, club by club</h3>
        <p className={styles.note}>
          Average and best carry, speed, sideways miss and carry consistency. Each value uses its
          available readings; fewer than 10 is an early sample.
        </p>
        <table className={styles.table} role="table">
          <caption className={styles.srOnly}>
            Results for this practice, separated by saved equipment and launch monitor.
          </caption>
          <thead role="rowgroup">
            <tr role="row">
              {[
                "Club / monitor",
                "Full shots",
                "Average carry",
                "Best carry",
                "Ball speed",
                "Sideways miss",
                "Carry spread",
              ].map((label) => (
                <th role="columnheader" scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {recap.clubs.map((club) => (
              <tr key={club.key} role="row">
                <th scope="row" role="rowheader" className={styles.club}>
                  <strong>{club.clubLabel}</strong>
                  <span>
                    {club.source}
                    {club.equipment ? ` · ${club.equipment}` : ""}
                  </span>
                  <span>
                    {club.offline.count
                      ? `${club.left} left · ${club.straight} within 2 yd · ${club.right} right`
                      : "Direction not measured"}
                  </span>
                </th>
                <td role="cell">
                  <span className={styles.mobileLabel}>Full shots</span>
                  <strong>{club.included}</strong>
                  <small>of {club.recorded} recorded</small>
                </td>
                {(
                  [
                    ["Average carry", club.carry, "yd"],
                    ["Best carry", { value: club.bestCarry, count: club.carry.count }, "yd"],
                    ["Ball speed", club.speed, "mph"],
                    ["Sideways miss", club.offline, "yd"],
                    ["Carry spread", club.spread, "yd"],
                  ] as const
                ).map(([label, metric, unit]) => (
                  <td role="cell" key={label}>
                    <span className={styles.mobileLabel}>{label}</span>
                    <strong>{reading(metric.value, unit)}</strong>
                    <small>
                      {metric.value === null
                        ? label === "Carry spread" && metric.count > 0
                          ? "Needs 3 carry readings"
                          : "—"
                        : `${metric.count} ${metric.count === 1 ? "reading" : "readings"}`}
                    </small>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.uploads}>
        <h3>Uploads behind this review</h3>
        <ul>
          {recap.uploads.map((upload, index) => (
            <li key={upload.id}>
              <Link href={`/sessions/${upload.id}`} prefetch={false}>
                <strong>
                  {upload.source} · upload {index + 1} ↗
                </strong>
                <span>
                  {upload.recorded} recorded · {upload.included} trusted full shots
                </span>
                {upload.fileName ? <small>{upload.fileName}</small> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
