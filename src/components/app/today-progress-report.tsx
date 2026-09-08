import Link from "next/link";
import type { TodayProgressReport as TodayProgressReportModel } from "@/lib/today-progress";
import styles from "./today-progress-report.module.css";

type ProgressVerdict = TodayProgressReportModel["verdict"];
type ProgressChange = TodayProgressReportModel["improvements"][number];
type ProgressMetric = TodayProgressReportModel["clubs"][number]["metrics"][number];

const verdictLabels: Record<ProgressVerdict, string> = {
  better: "Improving",
  worse: "Needs attention",
  mixed: "Mixed",
  steady: "Holding steady",
  building: "Building evidence",
};
const metricLabels = ["Sideways miss", "Carry spread", "Average carry", "Ball speed"];
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

/** The same measured progress readout stays visible on both Today surfaces. */
export function TodayProgressReport({
  report,
  historyError = false,
  clubType,
}: {
  report: TodayProgressReportModel | null;
  historyError?: boolean;
  clubType?: string;
}) {
  if (historyError) {
    return (
      <section
        className={styles.report}
        data-today-progress-report
        aria-labelledby="today-progress-title"
      >
        <h2 id="today-progress-title" className={styles.trendTitle}>
          Practice comparison couldn’t load
        </h2>
        <p className={styles.summary}>
          Your practice review is still available below.{" "}
          <Link href="/sessions" prefetch={false} className={styles.inlineLink}>
            Open saved sessions
          </Link>{" "}
          to review the earlier evidence.
        </p>
      </section>
    );
  }
  if (!report) return null;

  const recentDays = [...report.recentTrend.days]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 5);

  return (
    <section
      className={styles.report}
      data-today-progress-report
      data-progress-verdict={report.verdict}
      aria-labelledby="today-progress-title"
    >
      <div className={styles.topline}>
        <p className={styles.eyebrow}>Your practice progress</p>
        <p className={styles.dates}>
          <time dateTime={report.latest.dateKey}>{dateLabel(report.latest.dateKey)}</time>
          {report.previous ? (
            <>
              <span> vs </span>
              <time dateTime={report.previous.dateKey}>{dateLabel(report.previous.dateKey)}</time>
            </>
          ) : null}
        </p>
      </div>

      <div className={styles.overview}>
        <div className={styles.latest}>
          <h2 id="today-progress-title" className={styles.headline}>
            {report.headline}
          </h2>
          <p className={styles.summary}>{report.summary}</p>
          <p className={styles.coverage}>{report.coverage.label}</p>
        </div>
        <div className={styles.trend} data-today-progress-trend>
          <p className={styles.eyebrow}>Recent trend</p>
          <h3 className={styles.trendTitle}>{report.recentTrend.headline}</h3>
          <p className={styles.summary}>{report.recentTrend.summary}</p>
        </div>
      </div>

      {report.improvements.length || report.setbacks.length || report.changes.length ? (
        <div className={styles.changes} aria-label="What improved and what needs work">
          <ChangeList title="What improved" changes={report.improvements} direction="better" />
          <ChangeList title="What slipped" changes={report.setbacks} direction="worse" />
          <ChangeList title="Other changes" changes={report.changes} direction="steady" />
        </div>
      ) : null}

      {report.clubs.length ? (
        <details className={styles.comparisons} data-progress-club-comparison>
          <summary className={styles.comparisonSummary}>
            <h3>
              Club by club · {report.clubs.length} {report.clubs.length === 1 ? "club" : "clubs"}
              <span>View control, carry and speed comparisons</span>
            </h3>
          </summary>
          <div className={styles.sectionHeading}>
            <p>Previous → latest practice</p>
          </div>
          <table className={styles.table} role="table">
            <caption className={styles.srOnly}>
              Club measurements from the latest and previous practice. Lower average offline and
              carry spread indicate better control. Carry and speed changes are descriptive.
            </caption>
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  Club
                </th>
                {metricLabels.map((label) => (
                  <th scope="col" role="columnheader" key={label}>
                    {label}
                  </th>
                ))}
                <th scope="col" role="columnheader">
                  Readout
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {report.clubs.map((club) => (
                <tr key={club.key} role="row" data-progress-club-status={club.status}>
                  <th scope="row" role="rowheader" className={styles.club}>
                    <strong>{club.clubLabel}</strong>
                    {club.equipmentLabel ? <span>{club.equipmentLabel}</span> : null}
                    <span>
                      {club.previousShotCount} → {club.currentShotCount} shots
                    </span>
                  </th>
                  {club.metrics.map((metric) => (
                    <td
                      key={metric.key}
                      role="cell"
                      className={styles.metric}
                      title={`${metric.previousCount} previous readings; ${metric.currentCount} latest readings`}
                    >
                      <span className={styles.mobileMetricLabel} aria-hidden>
                        {metric.label}
                      </span>
                      <MetricReading metric={metric} />
                    </td>
                  ))}
                  <td role="cell" className={styles.readout}>
                    <span className={styles.verdict} data-tone={club.verdict}>
                      {club.status === "equipment-changed"
                        ? "Equipment changed"
                        : club.status === "unknown-equipment"
                          ? "Equipment unconfirmed"
                          : club.status === "new-club"
                            ? "New baseline"
                            : club.status === "low-sample"
                              ? "More shots needed"
                              : verdictLabels[club.verdict]}
                    </span>
                    <p>{club.reason}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}

      {recentDays.length ? (
        <div className={styles.history}>
          <h3>Recent practice</h3>
          <ol className={styles.days}>
            {recentDays.map((day) => (
              <li key={day.dateKey}>
                <Link
                  href={`/today?date=${encodeURIComponent(day.dateKey)}${clubType ? `&club=${encodeURIComponent(clubType)}` : ""}`}
                  prefetch={false}
                  aria-label={`Review practice from ${dateLabel(day.dateKey)}`}
                >
                  <time dateTime={day.dateKey}>{dateLabel(day.dateKey)}</time>
                  <span className={styles.verdict} data-tone={day.verdict}>
                    {day.verdict === "baseline" ? "Baseline" : verdictLabels[day.verdict]}
                  </span>
                  <span className={styles.dayTakeaway}>{day.takeaway}</span>
                  {day.baselineDateKey ? <span>vs {dateLabel(day.baselineDateKey)}</span> : null}
                  <span>
                    {day.eligibleShotCount} comparable shots · {day.clubCount} clubs
                  </span>
                  <span>
                    {day.uploadCount} {day.uploadCount === 1 ? "upload" : "uploads"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <details className={styles.method}>
        <summary>How this comparison works</summary>
        {report.method.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </details>
    </section>
  );
}

function ChangeList({
  title,
  changes,
  direction,
}: {
  title: string;
  changes: ProgressChange[];
  direction: ProgressVerdict;
}) {
  if (!changes.length) return null;
  return (
    <div className={styles.changeGroup} data-tone={direction}>
      <h3>{title}</h3>
      <ul>
        {changes.slice(0, 3).map((change) => (
          <li key={`${change.clubLabel}-${change.equipmentLabel}-${change.metric}`}>
            {change.text}
          </li>
        ))}
      </ul>
      {changes.length > 3 ? (
        <p className={styles.moreChanges}>
          {changes.length - 3} more in the club comparison below.
        </p>
      ) : null}
    </div>
  );
}

function MetricReading({ metric }: { metric: ProgressMetric }) {
  const direction =
    metric.direction === "improved"
      ? "better"
      : metric.direction === "declined"
        ? "worse"
        : "steady";
  return (
    <>
      <span className={styles.values}>
        <span className={styles.previous}>{reading(metric.previous)}</span>
        <span className={styles.arrow} aria-hidden>
          →
        </span>
        <span className={styles.srOnly}> to </span>
        <strong>{reading(metric.current)}</strong>
        <span className={styles.unit}>{metric.unit}</span>
      </span>
      <span className={styles.delta} data-tone={direction}>
        {metric.delta === null
          ? "No comparison"
          : metric.direction === "steady"
            ? "Similar"
            : `${metric.delta > 0 ? "+" : ""}${number.format(metric.delta)} ${metric.unit}${metric.direction === "improved" ? " · improved" : metric.direction === "declined" ? " · worse" : ""}`}
      </span>
      <span className={styles.srOnly}>
        {metric.previousCount} previous readings; {metric.currentCount} latest readings.
      </span>
    </>
  );
}

function reading(value: number | null) {
  return value === null ? "—" : number.format(value);
}

function dateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}
