"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compareClubCarryToBenchmark } from "@/lib/club-benchmarks";
import { BENCHMARK_REGISTRY } from "@/lib/benchmark-registry";
import type { PerformanceGroup, PerformanceIntelligence } from "@/lib/performance-intelligence";

export function ClubPerformanceIntelligence({
  intelligence,
  clubType,
  mode,
  clubLabels = {},
  clubTypes = {},
}: {
  intelligence: PerformanceIntelligence;
  clubType?: string;
  mode?: "current" | "coaching";
  clubLabels?: Record<string, string>;
  clubTypes?: Record<string, string>;
}) {
  const [selected, setSelected] = useState(0);
  const group = intelligence.groups[selected] ?? intelligence.groups[0];
  if (!group)
    return (
      <p className="text-sm text-muted-foreground">
        No eligible performance evidence yet. Import a measured session to establish a comparable
        sample.
      </p>
    );
  const body = (view: "current" | "coaching") =>
    view === "current" ? (
      <CurrentForm group={group} />
    ) : (
      <Coaching
        group={group}
        clubType={clubType ?? (group.clubId ? clubTypes[group.clubId] : undefined)}
      />
    );
  return (
    <section
      className="grid min-w-0 gap-4"
      aria-label="Performance intelligence"
      data-performance-intelligence
    >
      {intelligence.groups.length > 1 ? (
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          Comparable evidence
          <select
            className="min-h-11 w-full min-w-0 max-w-full rounded-md border bg-background px-3 text-foreground"
            value={selected}
            onChange={(event) => setSelected(Number(event.target.value))}
          >
            {intelligence.groups.map((item, index) => (
              <option key={item.id} value={index}>
                {contextLabel(item, clubLabels)} · {item.current.count} attempts
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-xs text-muted-foreground">{contextLabel(group, clubLabels)}</p>
      )}
      {mode ? (
        body(mode)
      ) : (
        <Tabs defaultValue="benchmarks" className="min-w-0 gap-4">
          <TabsList className="grid h-auto w-full grid-cols-3 sm:w-fit">
            <TabsTrigger className="min-h-11" value="benchmarks">
              Benchmarks
            </TabsTrigger>
            <TabsTrigger className="min-h-11" value="current">
              Current form
            </TabsTrigger>
            <TabsTrigger className="min-h-11" value="coaching">
              Coaching
            </TabsTrigger>
          </TabsList>
          <TabsContent value="benchmarks">
            <Potential group={group} clubType={clubType} />
          </TabsContent>
          <TabsContent value="current">{body("current")}</TabsContent>
          <TabsContent value="coaching">{body("coaching")}</TabsContent>
        </Tabs>
      )}
      <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium focus-visible:outline-2">
          Evidence and methodology
        </summary>
        <div className="mt-3 grid gap-2 break-words text-muted-foreground">
          <p>
            Potential uses the best 30 eligible full swings. Stock carry is the median of recent
            eligible stock shots. The observed P20–P80 range contains the middle 60% of carries; it
            is not a confidence interval or guarantee.
          </p>
          <p>
            All-attempt consistency retains identified genuine mishits. Unknown intent remains
            separate. Numerical changes compare equally weighted session summaries, so one large
            upload does not dominate.
          </p>
          <p>
            Current: latest {intelligence.options.sessionLimit} sessions within{" "}
            {intelligence.options.currentDays} days. Baseline: preceding{" "}
            {intelligence.options.sessionLimit} sessions within {intelligence.options.baselineDays}{" "}
            days. Current and baseline windows do not overlap. Actual dates and counts are shown;
            sparse windows are never silently extended. Evidence states describe sampling, not
            statistical certainty.
          </p>
          {group.missingContext.length ? (
            <p>
              Missing context: {group.missingContext.join(", ")}. Comparability and flight
              conclusions remain limited.
            </p>
          ) : null}
          <p>
            Calculation: {intelligence.ruleVersion}. Reference: {BENCHMARK_REGISTRY.version}.{" "}
            {BENCHMARK_REGISTRY.impactSummary}
          </p>
          <p>
            {group.current.exclusions.length
              ? group.current.exclusions.map((item) => `${item.reason}: ${item.count}`).join(" · ")
              : "No classified exclusions in the current window."}
          </p>
          {group.exclusions.length ? (
            <p>
              Supplied-history exclusions:{" "}
              {group.exclusions.map((item) => `${item.reason}: ${item.count}`).join(" · ")}
            </p>
          ) : null}
          <p>
            Configuration:{" "}
            {Object.entries(group.context)
              .map(([key, value]) => `${key}: ${value ?? "unknown"}`)
              .join(" · ")}
          </p>
          <details className="min-w-0">
            <summary className="cursor-pointer">
              Supporting observation IDs (
              {new Set([...group.potential.shotIds, ...group.current.shotIds]).size})
            </summary>
            <p className="mt-2 max-h-48 overflow-y-auto break-all">
              {[...new Set([...group.potential.shotIds, ...group.current.shotIds])].join(", ") ||
                "None"}
            </p>
          </details>
        </div>
      </details>
    </section>
  );
}

function Potential({ group, clubType }: { group: PerformanceGroup; clubType?: string }) {
  const comparison = clubType
    ? compareClubCarryToBenchmark(clubType, group.potential.meanYd)
    : null;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Selected potential</h3>
        <Badge variant="outline">
          {group.potential.selectedCount < 30
            ? `Provisional best-${group.potential.selectedCount}`
            : "Best-30"}
        </Badge>
        {comparison ? <Badge variant="outline">{comparison.levelLabel} carry band</Badge> : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumberFact label="Potential carry" value={group.potential.meanYd} />
        <NumberFact label="Current stock carry" value={group.current.stockCarryYd} />
        <NumberFact label="Verified maximum" value={group.potential.maximumYd} />
      </div>
      <p className="text-sm text-muted-foreground">
        {group.potential.selectedCount} selected from {group.potential.eligibleCount} eligible
        observations in the supplied history (
        {dateRange(group.potential.startAt, group.potential.endAt)}). Selected potential and current
        stock describe different shot sets.
      </p>
      {comparison?.nextLevel ? (
        <p className="text-sm">
          {comparison.nextLevel.label} threshold: {comparison.nextLevel.yards} yd · gap:{" "}
          {format(comparison.yardsToNextLevel)} yd in the selected average. Each shot does not need
          to exceed the threshold.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        LMWT benchmark bands · {BENCHMARK_REGISTRY.version}. A metric band does not rate the whole
        golfer.
      </p>
    </div>
  );
}

function CurrentForm({ group }: { group: PerformanceGroup }) {
  const current = group.current;
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{group.comparison.state}</h3>
        <Badge variant="outline">{group.comparison.label}</Badge>
        <Badge variant="outline">{current.readiness}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <NumberFact label="Stock carry · median" value={current.stockCarryYd} />
        <div>
          <p className="text-xs text-muted-foreground">Middle 60% observed carry</p>
          <p className="font-semibold tabular-nums">
            {format(current.p20Yd)}–{format(current.p80Yd)} yd
          </p>
        </div>
        <NumberFact label="All-attempt absolute lateral error" value={current.absoluteLateralYd} />
        <NumberFact label="Signed directional bias" value={current.signedBiasYd} />
      </div>
      <p className="text-sm text-muted-foreground">
        Current: {dateRange(current.startAt, current.endAt)} · {current.sessionIds.length} sessions
        · {current.count} valid intended attempts · {current.stockCount} stock shots.
      </p>
      <p className="text-sm text-muted-foreground">
        Baseline: {dateRange(group.baseline.startAt, group.baseline.endAt)} ·{" "}
        {group.baseline.sessionIds.length} sessions · {group.baseline.count} valid intended
        attempts.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberFact label="Potential carry · selected mean" value={group.potential.meanYd} />
        <NumberFact label="Carry spread · P80–P20" value={current.carrySpreadYd} />
        <NumberFact
          label="Repeatability"
          value={current.repeatability === null ? null : current.repeatability * 100}
          unit="%"
        />
        <NumberFact
          label="Identified mishit rate"
          value={current.mishitRate === null ? null : current.mishitRate * 100}
          unit="%"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Repeatability requires an explicit saved target. Unclassified contact and intent remain
        unknown. A shorter carry or higher flight alone is not a performance diagnosis.
      </p>
      <CarryDistribution group={group} />
      <MetricComparison group={group} />
      <SessionDistribution group={group} />
    </div>
  );
}

function CarryDistribution({ group }: { group: PerformanceGroup }) {
  const observations = group.current.carryObservations;
  if (!observations.length) return null;
  const minimum = Math.min(...observations.map((shot) => shot.carryYd));
  const maximum = Math.max(...observations.map((shot) => shot.carryYd));
  const span = Math.max(1, maximum - minimum);
  const bins = Array.from({ length: 8 }, (_, index) => {
    const shots = observations.filter(
      (shot) => Math.min(7, Math.floor(((shot.carryYd - minimum) / span) * 8)) === index,
    );
    return {
      low: minimum + (span * index) / 8,
      high: minimum + (span * (index + 1)) / 8,
      count: shots.length,
      stock: shots.filter((shot) => shot.stock).length,
    };
  });
  const largest = Math.max(1, ...bins.map((bin) => bin.count));
  return (
    <figure
      aria-label="Actual all-attempt carry distribution"
      className="grid gap-2 rounded-lg border p-3"
    >
      <figcaption className="text-sm font-medium">
        Actual carry distribution · {observations.length} valid attempts
      </figcaption>
      <div className="grid grid-cols-8 items-end gap-1">
        {bins.map((bin, index) => (
          <div key={index} className="grid gap-1 text-center">
            <div className="flex h-20 items-end justify-center">
              <div
                className="w-full rounded-t bg-primary"
                style={{ height: `${(bin.count / largest) * 100}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="text-xs tabular-nums">{bin.count}</span>
            <span className="sr-only">
              {format(bin.low)} to {format(bin.high)} yards, {bin.count} attempts, {bin.stock} stock
              eligible.
            </span>
          </div>
        ))}
      </div>
      <p className="flex justify-between text-xs text-muted-foreground">
        <span>{format(minimum)} yd</span>
        <span>{format(maximum)} yd</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Counts include genuine mishits; stock exclusions remain visible in the evidence disclosure.
      </p>
    </figure>
  );
}

function MetricComparison({ group }: { group: PerformanceGroup }) {
  const definitions = [
    ["stockCarryYd", "Stock carry", "yd"],
    ["ballSpeedMph", "Ball speed", "mph"],
    ["clubSpeedMph", "Club speed", "mph"],
    ["absoluteLateralYd", "Absolute lateral error", "yd"],
    ["signedBiasYd", "Signed bias", "yd"],
    ["carrySpreadYd", "Carry spread", "yd"],
    ["repeatability", "Repeatability", "%"],
    ["mishitRate", "Identified mishit rate", "%"],
  ] as const;
  return (
    <details className="min-w-0 rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Metric comparison and coverage
      </summary>
      <div
        className="mt-3 min-w-0 max-w-full overflow-x-auto"
        role="region"
        aria-label="Current and baseline metric comparison"
        tabIndex={0}
      >
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="pb-2 text-left text-xs text-muted-foreground">
            Current and baseline show pooled summaries; changes use equal-weight session summaries.
            A numerical change alone does not establish improvement.
          </caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Current</th>
              <th scope="col">Baseline</th>
              <th scope="col">Session-aware change</th>
            </tr>
          </thead>
          <tbody>
            {definitions.map(([key, label, unit]) => {
              const multiplier = unit === "%" ? 100 : 1;
              const read = (value: number | null) =>
                value === null ? "Unavailable" : `${(value * multiplier).toFixed(1)} ${unit}`;
              const delta = group.comparison.deltas[key];
              return (
                <tr key={key} className="border-t">
                  <th scope="row" className="py-2 font-medium">
                    {label}
                  </th>
                  <td>{read(group.current[key])}</td>
                  <td>{read(group.baseline[key])}</td>
                  <td>
                    {delta !== null && delta > 0 ? "+" : ""}
                    {read(delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Usable readings: carry {group.current.metricCounts.carryYd}; ball speed{" "}
        {group.current.metricCounts.ballSpeedMph}; club speed{" "}
        {group.current.metricCounts.clubSpeedMph}; lateral {group.current.metricCounts.sideCarryYd}.
        Provenance:{" "}
        {Object.entries(group.current.provenance)
          .map(
            ([metric, statuses]) =>
              `${metric}: ${
                Object.entries(statuses)
                  .map(([status, count]) => `${count} ${status}`)
                  .join(", ") || "unavailable"
              }`,
          )
          .join(" · ")}
      </p>
    </details>
  );
}

function SessionDistribution({ group }: { group: PerformanceGroup }) {
  const points = group.current.sessions.filter((point) => point.stockCarryYd !== null);
  const maximum = Math.max(1, ...points.map((point) => point.stockCarryYd ?? 0));
  return (
    <div className="grid gap-2" aria-label="Observed session stock carries">
      <h4 className="text-sm font-medium">Observed sessions</h4>
      {points.length ? (
        points.map((point) => (
          <div
            key={point.sessionId}
            className="grid grid-cols-[6rem_minmax(0,1fr)_5rem] items-center gap-2 text-xs"
          >
            <Link
              className="text-primary underline"
              href={`/sessions/${encodeURIComponent(point.sessionId)}`}
            >
              {date(point.date)}
            </Link>
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${((point.stockCarryYd ?? 0) / maximum) * 100}%` }}
              />
            </div>
            <span className="text-right tabular-nums">{format(point.stockCarryYd)} yd</span>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          No observed stock-carry sessions in this window.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Actual session medians; gaps between practice days contain no invented observations.
      </p>
    </div>
  );
}

function Coaching({ group, clubType }: { group: PerformanceGroup; clubType?: string }) {
  const recommendation = group.recommendation;
  return (
    <div className="grid gap-3">
      <h3 className="font-semibold">One next practice action</h3>
      <p className="text-sm">{recommendation.observation}</p>
      <p className="text-sm text-muted-foreground">{recommendation.comparison}</p>
      <p className="font-medium">{recommendation.action}</p>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">Success criterion</dt>
          <dd className="text-muted-foreground">{recommendation.successCriterion}</dd>
        </div>
        <div>
          <dt className="font-medium">Retest</dt>
          <dd className="text-muted-foreground">{recommendation.retest}</dd>
        </div>
        <div>
          <dt className="font-medium">Evidence confidence</dt>
          <dd className="text-muted-foreground">{recommendation.confidence}</dd>
        </div>
      </dl>
      {recommendation.limitations.length ? (
        <p className="text-sm text-muted-foreground">{recommendation.limitations.join(" ")}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/shots${clubType ? `?club=${encodeURIComponent(clubType)}` : ""}`}>
            View supporting shots
          </Link>
        </Button>
        <Button asChild>
          <Link
            href={`/practice/quick-range${clubType ? `?club=${encodeURIComponent(clubType)}` : ""}`}
          >
            Build practice
          </Link>
        </Button>
        {clubType === "driver" ? (
          <Button asChild variant="outline">
            <Link href="/speed">Speed development</Link>
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Rules-based explanation · {recommendation.shotIds.length} supporting observations across{" "}
        {recommendation.sessionIds.length} sessions. Observations do not establish hidden swing
        mechanics.
      </p>
    </div>
  );
}
function NumberFact({
  label,
  value,
  unit = "yd",
}: {
  label: string;
  value: number | null;
  unit?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">
        {format(value)}
        {value === null ? "" : ` ${unit}`}
      </p>
    </div>
  );
}
function format(value: number | null) {
  return value === null ? "Unavailable" : value.toFixed(1);
}
function date(value: string | null) {
  if (!value) return "No evidence";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed)
    : "Unknown date";
}
function dateRange(start: string | null, end: string | null) {
  return start && end ? `${date(start)}–${date(end)}` : "No comparable sessions";
}
function contextLabel(group: PerformanceGroup, labels: Record<string, string> = {}) {
  return [
    group.clubId ? (labels[group.clubId] ?? "Selected club") : null,
    group.context.source ?? "Source unknown",
    group.context.intent === "full"
      ? "Full swings"
      : `Intent: ${group.context.intent ?? "unknown"}`,
    group.context.settingsKey ? "Settings recorded" : "Settings unknown",
  ]
    .filter(Boolean)
    .join(" · ");
}
