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
            ["Longest recorded total", recap.longestTotal, "yd"],
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
          Each club combines its readings across all uploads and monitors. These are recorded
          measurements, without a calibration correction.{" "}
          <Link href="/equipment/launch-monitors/calibration" prefetch={false}>
            Review device comparison ↗
          </Link>
        </p>
      ) : null}
      <div id="today-practice-clubs" className={styles.clubs}>
        <h3>What you hit, club by club</h3>
        <p className={styles.note}>
          Carry is distance through the air; total includes roll. Bars show carry range with a
          marker for the average, on the same scale for every club.
        </p>
        <div className={styles.clubGrid}>
          {recap.clubs.map((club) => {
            const scale = Math.max(recap.longest?.value ?? 0, 1);
            const position = (value: number) =>
              `${Math.max(0, Math.min(100, (value / scale) * 100))}%`;
            return (
              <article
                className={styles.clubCard}
                key={club.key}
                aria-label={`${club.clubLabel} combined session results`}
              >
                <header className={styles.clubHeader}>
                  <div>
                    <h4>{club.clubLabel}</h4>
                    <p>{club.equipment || club.source}</p>
                  </div>
                  <span className={styles.shotBadge}>
                    {club.included} full {club.included === 1 ? "shot" : "shots"}
                  </span>
                </header>
                <div className={styles.carryHeadline}>
                  <div>
                    <span>Average carry</span>
                    <strong>{reading(club.carry.value, "yd")}</strong>
                  </div>
                  <div>
                    <span>Best carry</span>
                    <strong>{reading(club.bestCarry, "yd")}</strong>
                  </div>
                  <div>
                    <span>Best total</span>
                    <strong>{reading(club.bestTotal, "yd")}</strong>
                  </div>
                </div>
                {club.carry.value !== null &&
                club.shortestCarry !== null &&
                club.bestCarry !== null ? (
                  <div className={styles.carryGraphic}>
                    <div
                      className={styles.rangeTrack}
                      role="img"
                      aria-label={`Carry range ${reading(club.shortestCarry, "yd")} to ${reading(club.bestCarry, "yd")}, average ${reading(club.carry.value, "yd")}. Scale zero to ${reading(scale, "yd")}.`}
                    >
                      <span
                        className={styles.rangeBand}
                        style={{
                          left: position(club.shortestCarry),
                          width: position(club.bestCarry - club.shortestCarry),
                        }}
                      />
                      <span
                        className={styles.averageMarker}
                        style={{ left: position(club.carry.value) }}
                      />
                    </div>
                    <p>
                      <span>0 yd</span>
                      <span>Carry range</span>
                      <span>{reading(scale, "yd")}</span>
                    </p>
                  </div>
                ) : null}
                <dl className={styles.clubMetrics}>
                  {(
                    [
                      ["Ball speed", club.speed, "mph"],
                      ["Sideways miss", club.offline, "yd"],
                      ["Carry spread", club.spread, "yd"],
                    ] as const
                  ).map(([label, metric, unit]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{reading(metric.value, unit)}</dd>
                      {metric.value === null && label === "Carry spread" ? (
                        <small>Needs 3 readings</small>
                      ) : null}
                    </div>
                  ))}
                </dl>
                <div className={styles.direction}>
                  {club.offline.count ? (
                    <>
                      <div className={styles.directionTrack} aria-hidden="true">
                        <span
                          className={styles.leftShots}
                          style={{ width: `${(club.left / club.offline.count) * 100}%` }}
                        />
                        <span
                          className={styles.centreShots}
                          style={{ width: `${(club.straight / club.offline.count) * 100}%` }}
                        />
                        <span
                          className={styles.rightShots}
                          style={{ width: `${(club.right / club.offline.count) * 100}%` }}
                        />
                      </div>
                      <div className={styles.directionLabels}>
                        <span>← {club.left} left</span>
                        <span>{club.straight} within 2 yd</span>
                        <span>{club.right} right →</span>
                      </div>
                    </>
                  ) : (
                    <p className={styles.note}>Direction not measured</p>
                  )}
                </div>
                <details className={styles.clubFooter}>
                  <summary>Reading details{club.included < 10 ? " · Early sample" : ""}</summary>
                  <p>
                    {club.source} · {club.recorded} recorded · {club.included} trusted full shots
                  </p>
                  <p>
                    Shortest carry {reading(club.shortestCarry, "yd")}. Readings: {club.carry.count}{" "}
                    carry, {club.totalCount} total, {club.speed.count} speed, {club.offline.count}{" "}
                    sideways.
                  </p>
                </details>
              </article>
            );
          })}
        </div>
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
