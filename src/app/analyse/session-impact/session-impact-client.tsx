"use client";

import { useMemo, useState } from "react";
import { RotateCcw, ShieldCheck, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/app/segmented-control";
import { StatusPill } from "@/components/premium";
import { cn } from "@/lib/utils";
import {
  calculateSessionImpact,
  type SessionImpactFilter,
  type SessionImpactMetric,
  type SessionImpactShot,
} from "@/lib/session-impact";
import { confidenceDisplayLabel } from "@/lib/analysis-confidence";
import { buildPracticePrescription, type PracticeWeakness } from "@/lib/practice-prescription";

type ImpactShot = SessionImpactShot & {
  clubLabel: string;
  shotNumber: number | null;
};

const filterOptions: Array<{ label: string; filter: SessionImpactFilter }> = [
  { label: "All shots", filter: { kind: "none" } },
  { label: "Trusted", filter: { kind: "trusted" } },
  { label: "No tops", filter: { kind: "topped" } },
  { label: "No misreads", filter: { kind: "likely-misreads" } },
  { label: "Central 90%", filter: { kind: "best-percentile", keep: 0.9 } },
  { label: "Central 80%", filter: { kind: "best-percentile", keep: 0.8 } },
];

export function SessionImpactClient({ shots }: { shots: ImpactShot[] }) {
  const [metric, setMetric] = useState<SessionImpactMetric>("carry");
  const [filterIndex, setFilterIndex] = useState(0);
  const [selectedShotId, setSelectedShotId] = useState(shots[0]?.id ?? "");
  const [excludeSelected, setExcludeSelected] = useState(false);
  const filter = excludeSelected
    ? ({ kind: "selected", shotId: selectedShotId } satisfies SessionImpactFilter)
    : (filterOptions[filterIndex]?.filter ?? filterOptions[0]!.filter);
  const impact = useMemo(
    () => calculateSessionImpact(shots, filter, metric),
    [filter, metric, shots],
  );
  const prescription = useMemo(() => {
    const weakness = impactWeakness(impact.after);
    const clubLabels = [...new Set(impact.includedShots.map((shot) => shot.clubLabel))];
    return buildPracticePrescription({
      clubLabel: clubLabels.length === 1 ? clubLabels[0]! : "selected club mix",
      weakness,
      evidence: impactEvidence(impact.after, weakness),
      sampleSize: impact.after.shotCount,
    });
  }, [impact]);

  if (shots.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold">No measured shots in this session</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose another session or import launch-monitor data before running an impact comparison.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Reversible filter</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Nothing is deleted. Every comparison keeps the raw session and shows which shots are
              temporarily excluded.
            </p>
          </div>
          <StatusPill tone={impact.excludedShotIds.length ? "amber" : "green"}>
            {impact.excludedShotIds.length} excluded
          </StatusPill>
        </div>

        <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
          <SegmentedControl
            label="Distance metric"
            value={metric}
            options={[
              { value: "carry", label: "Carry" },
              { value: "total", label: "Total" },
            ]}
            onChange={(value) => setMetric(value as SessionImpactMetric)}
          />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Analysis filter
            </p>
            <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filterOptions.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    setExcludeSelected(false);
                    setFilterIndex(index);
                  }}
                  aria-pressed={!excludeSelected && filterIndex === index}
                  className={cn(
                    "focus-aaa min-h-11 shrink-0 rounded-xl border px-3 text-sm font-medium transition-colors motion-reduce:transition-none",
                    !excludeSelected && filterIndex === index
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-2 rounded-xl bg-secondary/55 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1.5 text-sm font-medium">
            Test one shot
            <select
              value={selectedShotId}
              onChange={(event) => setSelectedShotId(event.target.value)}
              className="focus-aaa min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
            >
              {shots.map((shot, index) => (
                <option key={shot.id} value={shot.id}>
                  Shot {shot.shotNumber ?? index + 1} · {shot.clubLabel} ·{" "}
                  {formatValue(
                    metric === "carry" ? shot.carryYd : (shot.totalYd ?? shot.carryYd),
                    "yd",
                  )}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant={excludeSelected ? "default" : "outline"}
            className="min-h-11 rounded-xl"
            onClick={() => setExcludeSelected((value) => !value)}
          >
            {excludeSelected ? (
              <RotateCcw className="size-4" aria-hidden />
            ) : (
              <Target className="size-4" aria-hidden />
            )}
            {excludeSelected ? "Restore shot" : "Exclude selected"}
          </Button>
        </div>
      </section>

      <section
        aria-labelledby="impact-results"
        className="overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="border-b border-border p-4 sm:p-5">
          <h2 id="impact-results" className="text-xl font-semibold">
            Before and after
          </h2>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {impact.before.shotCount} raw shots compared with {impact.after.shotCount} included
            shots.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          <ComparisonMetric
            label="Average"
            before={impact.before.averageYd}
            after={impact.after.averageYd}
            unit="yd"
          />
          <ComparisonMetric
            label="Median"
            before={impact.before.medianYd}
            after={impact.after.medianYd}
            unit="yd"
          />
          <ComparisonMetric
            label="Standard deviation"
            before={impact.before.standardDeviationYd}
            after={impact.after.standardDeviationYd}
            unit="yd"
          />
          <ComparisonMetric
            label="Carry range"
            before={impact.before.distanceRangeYd}
            after={impact.after.distanceRangeYd}
            unit="yd"
          />
          <ComparisonMetric
            label="Landing area"
            before={impact.before.dispersionAreaSqYd}
            after={impact.after.dispersionAreaSqYd}
            unit="sq yd"
          />
          <ComparisonMetric
            label="Offline bias"
            before={impact.before.offlineBiasYd}
            after={impact.after.offlineBiasYd}
            unit="yd"
          />
          <ComparisonMetric
            label="Session score"
            before={impact.before.sessionScore}
            after={impact.after.sessionScore}
            unit="/100"
          />
          <ComparisonMetric
            label="Repeatability"
            before={impact.before.repeatability.score}
            after={impact.after.repeatability.score}
            unit="/100"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <LandingPathMap
          shots={shots}
          excludedIds={new Set(impact.excludedShotIds)}
          metric={metric}
        />
        <aside className="grid content-start gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" aria-hidden />
            <h2 className="font-semibold">What changes next</h2>
          </div>
          <p className="text-sm leading-6 text-foreground">{impact.after.recommendation}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {impact.after.repeatability.explanation}
          </p>
          <StatusPill
            tone={impact.after.repeatability.confidence.label === "early" ? "amber" : "green"}
          >
            {confidenceDisplayLabel(impact.after.repeatability.confidence.label)}
          </StatusPill>
          <p className="text-xs leading-5 text-muted-foreground">
            Confidence uses sample size, session count, recency, metric coverage and variance. This
            single-session view remains conservative about across-session consistency.
          </p>
          <div className="mt-1 grid gap-3 border-t border-border pt-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Practice goal
              </p>
              <p className="mt-1 text-sm font-medium">{prescription.goal}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Volume</p>
                <p className="mt-1 font-semibold tabular-nums">{prescription.shots} shots</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Evidence</p>
                <p className="mt-1 font-semibold">{prescription.confidence}</p>
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">Success:</strong> {prescription.successThreshold}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">Stop:</strong> {prescription.stopCondition}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ComparisonMetric({
  label,
  before,
  after,
  unit,
}: {
  label: string;
  before: number | null;
  after: number | null;
  unit: string;
}) {
  return (
    <div className="border-b border-border p-4 last:border-b-0 sm:border-r xl:[&:nth-child(4n)]:border-r-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-2 tabular-nums">
        <span className="text-sm text-muted-foreground line-through decoration-border">
          {formatValue(before, unit)}
        </span>
        <span aria-hidden className="text-muted-foreground">
          →
        </span>
        <strong className="text-lg">{formatValue(after, unit)}</strong>
      </div>
    </div>
  );
}

function LandingPathMap({
  shots,
  excludedIds,
  metric,
}: {
  shots: ImpactShot[];
  excludedIds: Set<string>;
  metric: SessionImpactMetric;
}) {
  const plotted = shots
    .map((shot) => ({
      shot,
      distance: metric === "carry" ? shot.carryYd : (shot.totalYd ?? shot.carryYd),
    }))
    .filter(
      (row): row is typeof row & { distance: number } => row.distance !== null && row.distance > 0,
    );
  const maxDistance = Math.max(1, ...plotted.map((row) => row.distance));
  const maxSide = Math.max(20, ...plotted.map((row) => Math.abs(row.shot.sideYd ?? 0)));
  const point = (distance: number, side: number) => ({
    x: 160 + (side / maxSide) * 125,
    y: 335 - (distance / maxDistance) * 295,
  });
  const includedPaths = plotted.filter(({ shot }) => !excludedIds.has(shot.id));
  const excludedPathCount = plotted.length - includedPaths.length;
  const averageSideYd = includedPaths.length
    ? includedPaths.reduce((total, { shot }) => total + (shot.sideYd ?? 0), 0) /
      includedPaths.length
    : 0;
  const averageSideLabel =
    Math.abs(averageSideYd) < 0.5
      ? "centred on the target line"
      : `${Math.abs(averageSideYd).toLocaleString("en-GB", { maximumFractionDigits: 1 })} yards ${averageSideYd < 0 ? "left" : "right"}`;

  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-card">
      <figcaption className="border-b border-border p-4 sm:p-5">
        <h2 className="font-semibold">Top-down path estimate</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Curves are estimated from measured landing endpoints; they are not measured ball-flight
          trajectories.
        </p>
      </figcaption>
      <svg
        viewBox="0 0 320 360"
        className="block aspect-[8/9] max-h-[34rem] w-full bg-secondary/35"
        role="img"
        aria-label={`Top-down summary of ${plotted.length} shot paths`}
        aria-describedby="flight-path-summary"
      >
        <line
          x1="160"
          y1="20"
          x2="160"
          y2="340"
          stroke="currentColor"
          className="text-border"
          strokeDasharray="6 7"
        />
        <text x="166" y="30" className="fill-muted-foreground text-[10px]">
          Target line
        </text>
        {plotted.map(({ shot, distance }) => {
          const landing = point(distance, shot.sideYd ?? 0);
          const excluded = excludedIds.has(shot.id);
          const colour = excluded ? "#dc2626" : "#0f8f4d";
          return (
            <g key={shot.id} opacity={excluded ? 0.42 : 0.78}>
              <path
                d={`M 160 340 Q ${160 + (landing.x - 160) * 0.32} ${(340 + landing.y) / 2} ${landing.x} ${landing.y}`}
                fill="none"
                stroke={colour}
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <circle cx={landing.x} cy={landing.y} r="3.2" fill={colour} />
            </g>
          );
        })}
        <circle cx="160" cy="340" r="5" className="fill-foreground" />
      </svg>
      <p id="flight-path-summary" data-flight-path-summary className="sr-only">
        {includedPaths.length} included paths and {excludedPathCount} excluded paths. The included
        landing positions average {averageSideLabel}. Paths are estimated from landing endpoints.
      </p>
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        Green paths are included. Faded red paths are excluded from the current comparison.
        Target-relative sign follows the stored offline value.
      </p>
    </figure>
  );
}

function formatValue(value: number | null, unit: string) {
  return value === null
    ? "—"
    : `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })} ${unit}`;
}

function impactWeakness(
  summary: ReturnType<typeof calculateSessionImpact>["after"],
): PracticeWeakness {
  if (Math.abs(summary.offlineBiasYd ?? 0) >= 15 || (summary.repeatability.sideIqrYd ?? 0) >= 18)
    return "direction";
  if ((summary.standardDeviationYd ?? 0) >= 15) return "distance";
  return summary.shotCount < 10 ? "baseline" : "strike";
}

function impactEvidence(
  summary: ReturnType<typeof calculateSessionImpact>["after"],
  weakness: PracticeWeakness,
) {
  if (weakness === "direction")
    return `Offline bias ${formatValue(summary.offlineBiasYd, "yd")} with a ${formatValue(summary.repeatability.sideIqrYd, "yd")} central directional range.`;
  if (weakness === "distance")
    return `Distance standard deviation is ${formatValue(summary.standardDeviationYd, "yd")} across ${summary.shotCount} included shots.`;
  return `${summary.shotCount} included shots produce a repeatability score of ${summary.repeatability.score}/100.`;
}
