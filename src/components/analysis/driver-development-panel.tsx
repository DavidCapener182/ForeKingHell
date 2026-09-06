import Link from "next/link";
import { getDriverDevelopmentSnapshot } from "@/lib/driver-development-data";
import type { DriverDevelopmentSnapshot, EvidenceMetric } from "@/lib/driver-development-snapshot";
import { alignmentStatus } from "@/lib/session-data-confidence";
import { SessionConfidenceControls } from "@/components/analysis/session-confidence-controls";

const number = (value: number | null, digits = 1) => (value === null ? "—" : value.toFixed(digits));
export async function DriverDevelopmentPanel({
  date,
  compact = false,
}: {
  date?: string;
  compact?: boolean;
}) {
  const snapshot = await getDriverDevelopmentSnapshot(undefined, date);
  if (!snapshot) return null;
  return <DriverDevelopmentCard snapshot={snapshot} compact={compact} />;
}
export function DriverDevelopmentCard({
  snapshot: s,
  compact = false,
}: {
  snapshot: DriverDevelopmentSnapshot;
  compact?: boolean;
}) {
  const uncertain = s.directionOmittedCount > 0 || s.directionReviewCount > 0;
  return (
    <section
      aria-label="Driver development evidence"
      data-driver-development-snapshot={s.date}
      className="w-full min-w-0 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Driver development · {s.date}
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            What changed in your latest Driver practice?
          </h2>
        </div>
        <Link
          className="text-sm font-medium text-primary underline underline-offset-4"
          href="/speed"
        >
          Speed development
        </Link>
      </div>
      <p className="mt-3 text-sm leading-6">{s.conclusion}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Average carry" metric={s.metrics.carry} unit="yd" />
        <Metric label="Playing speed" metric={s.metrics.clubSpeed} unit="mph" />
        <Metric label="Ball speed" metric={s.metrics.ballSpeed} unit="mph" />
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">200+ yd carry</p>
          <p className="mt-1 text-xl font-semibold">
            {s.repeatability.count} / {s.repeatability.sampleSize}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {number(s.repeatability.percent, 0)}% · repeatability target 70%
          </p>
        </div>
      </div>
      {uncertain && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Direction needs review: {s.directionOmittedCount} readings omitted from control analysis;{" "}
          {s.directionReviewCount} unusual finishes awaiting review. Carry and speed keep their
          separate checks.
        </p>
      )}
      <p className="mt-3 text-sm font-medium">Next: {s.nextAction}</p>
      <details className="mt-4" open={compact ? undefined : true}>
        <summary className="cursor-pointer text-sm font-medium">
          Speed, strike, launch and control evidence
        </summary>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {s.comparisonLabel} {s.currentShotCount} eligible / {s.rawShotCount} raw shots today.
          Launch changes are descriptive; this does not declare an optimal launch window.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {s.changes.map((c) => (
            <li
              key={c.key}
              className="flex flex-wrap justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>{c.label}</span>
              <span>
                {c.delta === null
                  ? "More evidence needed"
                  : `${c.delta > 0 ? "+" : ""}${number(c.delta, c.key === "smash" ? 2 : 1)} ${c.unit}`}{" "}
                · {c.status}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Stock carry", s.stockCarry],
            ["Course recommendation", s.courseCarry],
            ["Good carry · today’s 75th percentile", s.goodStrikeCarry],
            ["Capability · today’s 90th percentile", s.capabilityCarry],
            ["Best carry today", s.bestCarry],
            ["Peak measured speed today", s.peakSpeed],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-semibold">
                {number(value as number | null)} {String(label).includes("speed") ? "mph" : "yd"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Stock and course numbers use the existing bag method for this comparison’s club, source
          and context. Today’s upper percentiles describe capability, not a course recommendation.
          Peaks here are session values, not personal-best claims.
        </p>
        <p className="mt-3 text-sm">
          Project {s.project.goal} · {number(s.project.evidenceBestCarry)} yd best in the Speed
          evidence · {number(s.project.bestGap)} yd to {s.project.goal}. Today’s best:{" "}
          {number(s.bestCarry)} yd. Reaching a peak does not establish repeatability.
        </p>
      </details>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium">
          Review alignment for these uploads
        </summary>
        <div className="mt-3 grid gap-3">
          {s.sessions.map((session) => (
            <SessionConfidenceControls
              key={session.id}
              sessionId={session.id}
              alignment={alignmentStatus(session.confidence.alignment)}
              label={session.label}
            />
          ))}
        </div>
      </details>
    </section>
  );
}
function Metric({ label, metric, unit }: { label: string; metric: EvidenceMetric; unit: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">
        {number(metric.value)} <span className="text-sm font-normal">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {metric.sampleSize} readings · {metric.confidence}
      </p>
    </div>
  );
}
