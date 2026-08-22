import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  Database,
  Flame,
  Info,
  LineChart,
  Radar,
  SlidersHorizontal,
  Target,
  Upload,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { GappingMatrixClient } from "@/app/simulator-lab/gapping-matrix-client";
import { SessionRoastPanel } from "@/app/simulator-lab/session-roast-panel";
import { WhatIfClient } from "@/app/simulator-lab/what-if-client";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  CompactReadoutGrid,
  DataPanel,
  DataTableFrame,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getSimulatorLabData,
  type EquipmentChangeImpact,
  type SessionDeltaRow,
} from "@/lib/simulator-lab";
import type {
  CostlyShotGroup,
  RangeRealityHandicapData,
  RealityFlightLine,
} from "@/lib/reality-handicap";
import { buildDispersionCorridorBuckets } from "@/lib/dispersion-corridor";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const sessionDeltaColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "samples", label: "Samples" },
  { id: "carry", label: "Carry" },
  { id: "ball", label: "Ball" },
  { id: "smash", label: "Smash" },
  { id: "offline", label: "Offline" },
  { id: "verdict", label: "Verdict", locked: true },
];

const sessionDeltaSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Latest simulator changes",
    href: "/simulator-lab#simulator-session-deltas",
    detail: "Review clubs whose latest indoor session moved against the 30-day baseline.",
  },
  {
    title: "Offline control check",
    href: "/simulator-lab#simulator-session-deltas",
    detail: "Keep club, samples, offline and verdict visible for direction-control review.",
  },
];

const equipmentImpactColumns: DesktopWorkbenchColumn[] = [
  { id: "change", label: "Change", locked: true },
  { id: "samples", label: "Samples" },
  { id: "carry", label: "Carry" },
  { id: "ball", label: "Ball" },
  { id: "smash", label: "Smash" },
  { id: "offline", label: "Offline" },
  { id: "verdict", label: "Verdict", locked: true },
];

const equipmentImpactSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Before/after equipment proof",
    href: "/simulator-lab#simulator-equipment-impact",
    detail: "Compare carry, speed and offline movement around logged setup changes.",
  },
  {
    title: "Equipment regressions",
    href: "/simulator-lab#simulator-equipment-impact",
    detail: "Start with verdict and samples before trusting an equipment-change result.",
  },
];

export default async function SimulatorLabPage({ searchParams }: PageProps<"/simulator-lab">) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <PageShell>
        <DesktopWorkbenchLayout scope="simulator-lab">
          <PageHeader
            eyebrow={
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Setup
              </span>
            }
            title="Performance Lab"
            description="Database connection required before launch-monitor analytics can load."
          />
        </DesktopWorkbenchLayout>
      </PageShell>
    );
  }

  const query = await searchParams;
  const rangeClub = firstQueryValue(query.rangeClub);
  const rangeMiss = firstQueryValue(query.rangeMiss);
  const data = await getSimulatorLabData();
  const latestSessionLabel = data.latestSession
    ? `${data.latestSession.source} / ${dateFormatter.format(data.latestSession.date)}`
    : "No simulator session";

  return (
    <PageShell contentClassName="pb-5">
      <DesktopWorkbenchLayout scope="simulator-lab">
        <PageHeader
          eyebrow={
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Performance Lab
            </span>
          }
          title="Performance Lab"
          description="WITB gapping, indoor-session deltas and range-handicap coaching from saved launch-monitor data."
          actions={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link href="/import?source=csv#csv-import" prefetch={false}>
                  <Upload className="size-4" />
                  Import CSV
                </Link>
              </Button>
              <Button asChild>
                <Link href="/equipment" prefetch={false}>
                  <Wrench className="size-4" />
                  Log setup
                </Link>
              </Button>
            </div>
          }
          metrics={[
            {
              label: "Range reality",
              value: data.rangeReality.estimate.label,
              detail: data.rangeReality.estimate.confidenceLabel,
            },
            {
              label: "Usable range shots",
              value: data.rangeReality.estimate.usableShotCount,
              detail: `${latestSessionLabel} / ${data.rangeReality.estimate.clubCount} clubs`,
            },
            {
              label: "Bag gaps",
              value: data.totals.gapFlags,
              detail: "Overlap or missing windows",
            },
            {
              label: "Trending up",
              value: data.totals.positiveDeltas,
              detail: "Clubs beating 30-day baseline",
            },
          ]}
        />

        {data.dataIssues?.length ? (
          <DataPanel className="border-[var(--status-warning-border)] bg-[var(--status-warning-surface)]">
            <SectionHeader
              title="Simulator data caveat"
              description="The lab rendered with partial data rather than blocking the workspace."
              action={<AlertTriangle className="size-5 text-[var(--status-warning-foreground)]" />}
            />
            <CardContent className="grid gap-2 text-sm leading-6 text-[var(--status-warning-foreground)]">
              {data.dataIssues.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
            </CardContent>
          </DataPanel>
        ) : null}

        <RangeRealityCockpit
          reality={data.rangeReality}
          rangeClub={rangeClub}
          rangeMiss={rangeMiss}
        />

        <section className="grid gap-4">
          <DataPanel>
            <SectionHeader
              title="WITB gapping matrix"
              description="Recommended carry is plotted first; best stock and latest reliable stay visible for trust checks."
              action={<Target className="size-5 text-primary" />}
            />
            <CardContent>
              <GappingMatrixClient rows={data.gappingRows} />
            </CardContent>
          </DataPanel>
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <DataPanel>
            <SectionHeader
              title="Session deltas"
              description="Latest indoor session against the prior 30 days for the same clubs."
              action={<Activity className="size-5 text-[var(--status-information-foreground)]" />}
            />
            <CardContent>
              <SessionDeltaTable rows={data.sessionDeltas} />
            </CardContent>
          </DataPanel>

          <div className="grid gap-4">
            <DataPanel>
              <SectionHeader
                title="Tinkering ledger"
                description="Dated setup changes compared with 30-day before and after windows."
                action={<SlidersHorizontal className="size-5 text-primary" />}
              />
              <CardContent>
                <EquipmentImpactTable impacts={data.equipmentImpacts} />
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Next actions"
                description="Keep the lab useful by feeding it comparable sessions and dated setup changes."
                action={<Radar className="size-5 text-muted-foreground" />}
              />
              <CardContent>
                <CompactReadoutGrid
                  columnsClassName="grid-cols-1"
                  items={[
                    {
                      label: "Import",
                      value: "Save TrackMan, Square or Rapsodo CSVs",
                      tone: "green",
                    },
                    {
                      label: "Retest",
                      value: "Build 3 latest and 5 baseline shots per club",
                      tone: "sky",
                    },
                    {
                      label: "Prove",
                      value: "Log loft, shaft or ball changes before testing",
                      tone: "amber",
                    },
                  ]}
                />
              </CardContent>
            </DataPanel>
          </div>
        </section>

        <DataPanel>
          <SectionHeader
            title="Community extras"
            description="Optional, private session banter kept away from the coaching workflow."
            action={<Flame className="size-5 text-destructive" />}
          />
          <CardContent>
            <Collapsible className="rounded-lg border bg-card/70 p-3">
              <CollapsibleTrigger className="w-full cursor-pointer text-left text-sm font-semibold">
                Roast draft
              </CollapsibleTrigger>
              <CollapsibleContent
                forceMount
                outerClassName="data-[state=closed]:hidden"
                className="mt-3"
              >
                <SessionRoastPanel session={data.latestSession} facts={data.roastFacts} />
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </DataPanel>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function RangeRealityCockpit({
  reality,
  rangeClub,
  rangeMiss,
}: {
  reality: RangeRealityHandicapData;
  rangeClub: string | null;
  rangeMiss: string | null;
}) {
  const estimate = reality.estimate;
  const health = buildGolfHealth(reality);
  const readiness = buildReadiness(reality, health);
  const trendPrefix =
    estimate.trend.direction === "improving"
      ? "Improved"
      : estimate.trend.direction === "worse"
        ? "Drifted"
        : estimate.trend.direction === "flat"
          ? "Holding"
          : "Building";

  return (
    <section id="range-reality" className="grid scroll-mt-28 gap-5">
      <DataPanel className="border-[var(--status-success-border)] bg-[var(--status-success-surface)]">
        <SectionHeader
          title="Range reality handicap"
          description={estimate.disclaimer}
          action={
            <StatusPill tone={statusTone(estimate.confidence)}>
              {estimate.confidenceLabel}
            </StatusPill>
          }
        />
        <CardContent className="grid items-start gap-5 xl:grid-cols-[0.68fr_1.32fr]">
          <div className="grid gap-3">
            <div className="apple-panel-strong overflow-hidden p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Launch Monitor Handicap
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-xs",
                    toneBadgeClass(trendTone(estimate.trend.direction)),
                  )}
                >
                  {trendPrefix}
                </span>
              </div>
              <p className="mt-3 text-[6rem] font-semibold leading-none tracking-normal sm:text-[7rem] xl:text-[8rem]">
                {estimate.label}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border bg-card/70 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Expected
                  </p>
                  <p className="mt-1 text-xl font-semibold">{estimate.expectedRangeLabel}</p>
                </div>
                <div className="rounded-lg border bg-card/70 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Trend</p>
                  <p
                    className={cn(
                      "mt-1 text-xl font-semibold",
                      toneTextClass(trendTone(estimate.trend.direction)),
                    )}
                  >
                    {estimate.trend.delta !== null
                      ? numberFormatter.format(Math.abs(estimate.trend.delta))
                      : "--"}
                  </p>
                </div>
              </div>
              <Collapsible className="mt-4 rounded-lg border bg-card/70 p-3 text-sm">
                <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 text-left font-medium">
                  <Info className="size-4 text-primary" />
                  How is this calculated?
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 leading-6 text-muted-foreground">
                  {estimate.methodLabel}
                </CollapsibleContent>
              </Collapsible>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/practice" prefetch={false}>
                    <Target className="size-4" />
                    Build practice
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/handicap#range-reality" prefetch={false}>
                    <LineChart className="size-4" />
                    Handicap view
                  </Link>
                </Button>
              </div>
            </div>
            <CoachSummaryCard reality={reality} />
            {estimate.caveats.length > 0 ? (
              <Collapsible className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] px-3 py-2 text-sm text-[var(--status-warning-foreground)]">
                <CollapsibleTrigger className="w-full cursor-pointer text-left font-medium">
                  Estimate caveats ({estimate.caveats.length})
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 grid gap-1.5 leading-6">
                  {estimate.caveats.slice(0, 3).map((caveat) => (
                    <p key={caveat}>{caveat}</p>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
          <div className="grid gap-3">
            <ReadinessCard readiness={readiness} />
            <GolfHealthCard health={health} />
            <div className="apple-panel p-4">
              <p className="text-sm leading-6">
                <span className="font-semibold">{estimate.usableShotCount}</span> usable shots,{" "}
                <span className="font-semibold">{estimate.clubCount}</span> clubs benchmarked,{" "}
                <span className="font-semibold">{estimate.sessionCount}</span> sessions analysed.
                Confidence is{" "}
                <span className="font-semibold">{estimate.confidenceLabel.toLowerCase()}</span>;
                trend is <span className="font-semibold">{estimate.trend.label}</span>.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${estimate.confidenceScore}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Confidence {estimate.confidenceScore}% / latest {estimate.modelShotCount} of{" "}
                {estimate.usableShotCount} usable shots are weighted first.
              </p>
            </div>
          </div>
        </CardContent>
      </DataPanel>

      <section className="grid items-start gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <DataPanel>
          <SectionHeader
            title="What cost shots"
            description="Grouped coaching causes ranked by likely score damage."
            action={<AlertTriangle className="size-5 text-destructive" />}
          />
          <CardContent>
            {reality.costlyShotGroups.length > 0 ? (
              <div className="grid gap-4">
                {reality.costlyShotGroups.map((group) => (
                  <CostGroupCard key={group.id} group={group} />
                ))}
                {reality.costlyShots.length > 0 ? (
                  <div className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-surface)] p-3 text-sm leading-6 text-destructive">
                    Worst single shot: {reality.costlyShots[0]?.reason} (+
                    {numberFormatter.format(reality.costlyShots[0]?.scoreCost ?? 0)})
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyPanel
                icon={Database}
                text="Import range shots with carry and side data to rank costly misses."
              />
            )}
          </CardContent>
        </DataPanel>

        <div className="grid gap-4">
          <DataPanel>
            <SectionHeader
              title="Shot pattern map"
              description="Filter recent launch-monitor flight lines by club or miss pattern."
              action={<Radar className="size-5 text-primary" />}
            />
            <CardContent>
              <FlightLineMap
                lines={reality.flightLines}
                rangeClub={rangeClub}
                rangeMiss={rangeMiss}
              />
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Score killers"
              action={<Flame className="size-5 text-destructive" />}
            />
            <CardContent className="grid gap-3 lg:grid-cols-3">
              {reality.disasterScenarios.map((scenario) => (
                <div key={scenario.id} className="apple-panel rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{scenario.title}</p>
                    <span className={toneTextClass(scenario.tone)}>{scenario.value}</span>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{scenario.detail}</p>
                </div>
              ))}
            </CardContent>
          </DataPanel>
        </div>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <DataPanel>
          <SectionHeader title="Bag truth" action={<Target className="size-5 text-primary" />} />
          <CardContent className="grid gap-3">
            {reality.bagTruth.length > 0 ? (
              reality.bagTruth.slice(0, 4).map((item) => (
                <div
                  key={item.clubType}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-semibold">{item.clubLabel}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">{item.carryRangeLabel}</p>
                    <p className={cn("text-xs", toneTextClass(item.tone))}>
                      {item.confidenceLabel} / {item.sampleSize}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyPanel
                icon={Database}
                text="Import range shots to build trusted carry windows."
              />
            )}
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title="Today's practice"
            action={<Activity className="size-5 text-[var(--status-information-foreground)]" />}
          />
          <CardContent className="grid gap-3">
            {reality.prescriptions.map((item) => (
              <div key={item.id} className="apple-panel rounded-lg p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{item.title}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-1 text-xs",
                      toneBadgeClass(item.tone),
                    )}
                  >
                    {practicePriorityLabel(item.tone)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>
                <p className="mt-2 text-sm leading-5">{item.drill}</p>
              </div>
            ))}
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/practice" prefetch={false}>
                Open practice planner
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </DataPanel>
      </section>

      <DataPanel>
        <SectionHeader
          title="What if?"
          description="Explore how fixing the biggest practice leaks could move the range-handicap estimate."
          action={<SlidersHorizontal className="size-5 text-primary" />}
        />
        <CardContent>
          <WhatIfClient
            estimate={estimate.value}
            confidenceScore={estimate.confidenceScore}
            groups={reality.costlyShotGroups.slice(0, 2).map((group) => ({
              clubLabel: group.clubLabel,
              mainMiss: group.mainMisses[0] ?? "pattern",
              potentialGain: group.potentialGain,
            }))}
          />
        </CardContent>
      </DataPanel>

      <DataPanel>
        <SectionHeader
          title="Handicap confidence timeline"
          description="Monthly range-handicap checkpoints from usable launch-monitor sessions."
          action={<LineChart className="size-5 text-primary" />}
        />
        <CardContent>
          <ConfidenceTimeline reality={reality} />
        </CardContent>
      </DataPanel>
    </section>
  );
}

function CoachSummaryCard({ reality }: { reality: RangeRealityHandicapData }) {
  const estimate = reality.estimate;
  const topGroup = reality.costlyShotGroups[0] ?? null;
  const bagTrust = reality.bagTruth.filter((item) => item.confidenceLabel === "High").length;
  const gain = topGroup?.potentialGain ?? 0;

  return (
    <div className="apple-panel p-4">
      <div className="flex items-center gap-2">
        <Brain className="size-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          AI coach summary
        </p>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {estimate.value === null
          ? "The range handicap is still building. Add full-swing carry and offline data before trusting the trend."
          : topGroup
            ? `Overall: ${topGroup.clubLabel} is costing the most range-handicap points. ${topGroup.mainMisses[0]?.toLowerCase()} shows up in ${topGroup.occurrenceCount} scored misses. Fixing this could reduce your estimated handicap by around ${numberFormatter.format(gain)} shots.`
            : `Overall: the latest range sample is ${estimate.confidenceLabel.toLowerCase()} with ${bagTrust} trusted carry windows and no dominant score-loss pattern.`}
      </p>
    </div>
  );
}

type GolfHealthMetric = {
  label: string;
  score: number | null;
  detail: string;
  tone: "green" | "sky" | "amber" | "pink" | "slate";
};

type GolfHealth = {
  overall: number;
  metrics: GolfHealthMetric[];
};

type Readiness = {
  score: number;
  label: string;
  summary: string;
  expected: string;
  tone: "green" | "sky" | "amber" | "pink";
};

function ReadinessCard({ readiness }: { readiness: Readiness }) {
  return (
    <div className="apple-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Today&apos;s readiness
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{readiness.summary}</p>
        </div>
        <div className="text-right">
          <p className="text-5xl font-semibold leading-none">{readiness.score}%</p>
          <p className={cn("mt-1 text-xs", toneTextClass(readiness.tone))}>{readiness.label}</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", healthBarClass(readiness.tone))}
          style={{ width: `${readiness.score}%` }}
        />
      </div>
      <p className="mt-3 text-sm leading-5 text-muted-foreground">{readiness.expected}</p>
    </div>
  );
}

function GolfHealthCard({ health }: { health: GolfHealth }) {
  return (
    <div className="apple-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Playing profile
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Range evidence, not a full game audit.
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-semibold leading-none">{health.overall}</p>
          <p className="text-xs text-muted-foreground">/100</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {health.metrics.map((metric) => (
          <div
            key={metric.label}
            className="grid grid-cols-[5.75rem_minmax(0,1fr)_4.75rem] items-center gap-2 text-xs"
          >
            <span className="truncate font-medium">{metric.label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", healthBarClass(metric.tone))}
                style={{ width: `${metric.score ?? 8}%` }}
              />
            </div>
            <span className="text-right text-muted-foreground">
              {metric.score === null ? "No data" : healthLabel(metric.score)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostGroupCard({ group }: { group: CostlyShotGroup }) {
  return (
    <Link
      href={costGroupHref(group)}
      prefetch={false}
      className="apple-panel block rounded-lg p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{group.clubLabel}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {group.scoreLossSharePct}% of score loss / {group.occurrenceCount} occurrences
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs", toneBadgeClass(group.tone))}>
          +{numberFormatter.format(group.potentialGain)} gain
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-sm leading-5">
        {group.mainMisses.map((miss) => (
          <p key={miss}>• {miss}</p>
        ))}
        {group.averageOfflineYd !== null ? (
          <p className="text-muted-foreground">
            Average costly miss: {group.averageOfflineYd} yd offline
          </p>
        ) : null}
        <p className="text-xs font-medium text-primary">Open pattern</p>
      </div>
    </Link>
  );
}

function ConfidenceTimeline({ reality }: { reality: RangeRealityHandicapData }) {
  const timeline = reality.estimate.timeline;
  if (timeline.length === 0) {
    return <EmptyPanel icon={LineChart} text="Add dated range sessions to build the timeline." />;
  }
  const scored = timeline.filter((item) => item.value !== null);
  if (scored.length === 0) {
    return (
      <EmptyPanel icon={LineChart} text="Add more full-swing range sessions to plot progress." />
    );
  }
  const chartWidth = 1100;
  const chartHeight = 220;
  const padding = { top: 18, right: 24, bottom: 40, left: 44 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const values = scored.map((item) => item.value ?? 0);
  const minValue = Math.max(0, Math.floor(Math.min(...values) - 1));
  const maxValue = Math.ceil(Math.max(...values) + 1);
  const xScale = (index: number) =>
    padding.left +
    (timeline.length === 1 ? plotWidth / 2 : (index / (timeline.length - 1)) * plotWidth);
  const yScale = (value: number) =>
    padding.top + ((value - minValue) / Math.max(1, maxValue - minValue)) * plotHeight;
  const linePoints = timeline
    .map((item, index) => (item.value === null ? null : { item, index }))
    .filter((point): point is { item: (typeof timeline)[number]; index: number } => point !== null);
  const linePath = linePoints
    .map(
      ({ item, index }, pointIndex) =>
        `${pointIndex === 0 ? "M" : "L"} ${xScale(index)} ${yScale(item.value ?? 0)}`,
    )
    .join(" ");
  const confidencePath = [
    `M ${padding.left} ${chartHeight - padding.bottom}`,
    ...timeline.map((item, index) => {
      const confidenceY =
        chartHeight - padding.bottom - (item.confidenceScore / 100) * (plotHeight * 0.55);
      return `L ${xScale(index)} ${confidenceY}`;
    }),
    `L ${chartWidth - padding.right} ${chartHeight - padding.bottom}`,
    "Z",
  ].join(" ");
  const latest = scored[scored.length - 1];

  return (
    <div className="overflow-x-auto rounded-lg border bg-white p-3">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Range handicap confidence timeline"
        className="block h-auto min-w-[48rem] w-full"
      >
        <rect x={0} y={0} width={chartWidth} height={chartHeight} fill="white" />
        <path d={confidencePath} fill="#d1fae5" opacity={0.72} />
        {[minValue, Math.round((minValue + maxValue) / 2), maxValue].map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={chartWidth - padding.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="#e5e7eb"
            />
            <text
              x={padding.left - 10}
              y={yScale(tick) + 4}
              textAnchor="end"
              className="fill-slate-600 text-[12px]"
            >
              {tick}
            </text>
          </g>
        ))}
        <path d={linePath} fill="none" stroke="#0B7A3B" strokeLinecap="round" strokeWidth={4} />
        {timeline.map((item, index) =>
          item.value === null ? null : (
            <g key={item.id}>
              <circle
                cx={xScale(index)}
                cy={yScale(item.value)}
                r={6}
                fill="#0B7A3B"
                stroke="white"
                strokeWidth={2}
              />
              <text
                x={xScale(index)}
                y={chartHeight - 17}
                textAnchor="middle"
                className="fill-slate-600 text-[12px]"
              >
                {item.label}
              </text>
            </g>
          ),
        )}
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold">Latest {latest?.valueLabel}</p>
        <p className="text-muted-foreground">
          Shaded area shows confidence, line shows lower-is-better handicap estimate.
        </p>
      </div>
    </div>
  );
}

function FlightLineMap({
  lines,
  rangeClub,
  rangeMiss,
}: {
  lines: RealityFlightLine[];
  rangeClub: string | null;
  rangeMiss: string | null;
}) {
  if (lines.length === 0) {
    return (
      <EmptyPanel
        icon={Radar}
        text="Import range shots with carry and side carry to draw flight lines."
      />
    );
  }

  const filteredLines = filterFlightLines(lines, rangeClub, rangeMiss);
  const visibleLines = filteredLines.length > 0 ? filteredLines : lines;
  const chartWidth = 820;
  const chartHeight = 430;
  const padding = { top: 22, right: 36, bottom: 46, left: 54 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const maxCarry = niceChartMax(Math.max(...visibleLines.map((line) => line.carryYd)), 25);
  const maxSide = Math.max(
    20,
    niceChartMax(Math.max(...visibleLines.map((line) => Math.abs(line.sideYd))), 10),
  );
  const targetSide = Math.min(10, maxSide);
  const yTicks = chartTicks(maxCarry, 4);
  const xTicks = [-maxSide, -maxSide / 2, 0, maxSide / 2, maxSide];
  const xScale = (value: number) => padding.left + ((value + maxSide) / (maxSide * 2)) * plotWidth;
  const yScale = (value: number) => padding.top + plotHeight - (value / maxCarry) * plotHeight;
  const buckets = buildDispersionCorridorBuckets(
    visibleLines.map((line) => line.sideYd),
    {
      maxSideYd: maxSide,
      targetSideYd: targetSide,
    },
  );
  const averageCarry = average(visibleLines.map((line) => line.carryYd));
  const averageSide = average(visibleLines.map((line) => line.sideYd));
  const clubs = uniqueBy(lines, (line) => line.clubType);
  const activeLabel =
    filteredLines.length > 0 && rangeClub
      ? `${visibleLines[0]?.clubLabel ?? "Club"} ${rangeMiss ? missFilterLabel(rangeMiss) : ""}`
      : rangeMiss
        ? `All clubs ${missFilterLabel(rangeMiss)}`
        : "All clubs";
  const filterOptions = [
    {
      key: "all",
      href: "/simulator-lab#range-reality",
      active: !rangeClub && !rangeMiss,
      label: "All",
    },
    ...clubs.map((line) => ({
      key: `club-${line.clubType}`,
      href: `/simulator-lab?rangeClub=${encodeURIComponent(line.clubType)}#range-reality`,
      active: rangeClub === line.clubType && !rangeMiss,
      label: line.clubLabel,
    })),
    {
      key: "miss-left",
      href: "/simulator-lab?rangeMiss=left#range-reality",
      active: rangeMiss === "left",
      label: "Left miss",
    },
    {
      key: "miss-right",
      href: "/simulator-lab?rangeMiss=right#range-reality",
      active: rangeMiss === "right",
      label: "Right miss",
    },
    {
      key: "miss-danger",
      href: "/simulator-lab?rangeMiss=danger#range-reality",
      active: rangeMiss === "danger",
      label: "Danger",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label={`Shot filter · ${activeLabel.trim()}`}>
        {filterOptions.map((option) => (
          <FilterChip key={option.key} href={option.href} active={option.active}>
            {option.label}
          </FilterChip>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border bg-white">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="Range shot dispersion flight-line chart"
          className="block h-auto w-full"
        >
          <rect x={0} y={0} width={chartWidth} height={chartHeight} fill="white" />
          <rect
            x={xScale(-targetSide)}
            y={padding.top}
            width={xScale(targetSide) - xScale(-targetSide)}
            height={plotHeight}
            fill="#ecfdf5"
            opacity={0.72}
          />
          <text
            x={xScale(-maxSide * 0.72)}
            y={padding.top + 16}
            textAnchor="middle"
            className="fill-slate-500 text-[11px]"
          >
            left miss
          </text>
          <text
            x={xScale(maxSide * 0.72)}
            y={padding.top + 16}
            textAnchor="middle"
            className="fill-slate-500 text-[11px]"
          >
            right miss
          </text>
          <text
            x={xScale(0)}
            y={padding.top + 14}
            textAnchor="middle"
            className="fill-emerald-700 text-[10px] font-semibold uppercase tracking-[0.08em]"
          >
            Target corridor
          </text>
          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="#e5e7eb"
              />
              <text
                x={padding.left - 10}
                y={yScale(tick) + 4}
                textAnchor="end"
                className="fill-slate-600 text-[12px]"
              >
                {tick}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={xScale(tick)}
                x2={xScale(tick)}
                y1={padding.top}
                y2={chartHeight - padding.bottom}
                stroke={tick === 0 ? "#111827" : "#e5e7eb"}
                strokeDasharray={tick === 0 ? undefined : "4 4"}
                opacity={tick === 0 ? 0.5 : 1}
              />
              <text
                x={xScale(tick)}
                y={chartHeight - 18}
                textAnchor="middle"
                className="fill-slate-600 text-[12px]"
              >
                {formatChartTick(tick)}
              </text>
            </g>
          ))}
          <text x={padding.left} y={18} className="fill-slate-600 text-[12px]">
            carry yd
          </text>
          <text
            x={chartWidth / 2}
            y={chartHeight - 5}
            textAnchor="middle"
            className="fill-slate-600 text-[12px]"
          >
            left / right yd
          </text>
          {visibleLines.map((line) => (
            <path
              key={`trace-${line.id}`}
              d={rangeShapePath({ line, xScale, yScale })}
              fill="none"
              stroke={flightLineColor(line)}
              strokeLinecap="round"
              strokeWidth={line.isDirectionalDamage ? 2.1 : line.included ? 1.55 : 1.05}
              strokeOpacity={line.isDirectionalDamage ? 0.58 : line.included ? 0.32 : 0.22}
            />
          ))}
          {visibleLines.map((line) => (
            <circle
              key={`point-${line.id}`}
              cx={xScale(line.sideYd)}
              cy={yScale(line.carryYd)}
              r={line.isDirectionalDamage ? 5.8 : 4.8}
              fill={flightLineColor(line)}
              fillOpacity={line.isDirectionalDamage ? 0.94 : 0.84}
              stroke="white"
              strokeWidth={1.5}
            >
              <title>
                {line.isDirectionalDamage
                  ? `${line.clubLabel}: directional danger ${numberFormatter.format(Math.abs(line.sideYd))} yd offline`
                  : line.isCostly
                    ? `${line.clubLabel}: costly carry or strike shot +${numberFormatter.format(line.scoreCost)}`
                    : `${line.clubLabel}: playable plotted shot`}
              </title>
            </circle>
          ))}
          <g>
            <circle
              cx={xScale(averageSide)}
              cy={yScale(averageCarry)}
              r={9}
              fill="none"
              stroke="#0f172a"
              strokeWidth={2}
            />
            <line
              x1={xScale(averageSide) - 13}
              x2={xScale(averageSide) + 13}
              y1={yScale(averageCarry)}
              y2={yScale(averageCarry)}
              stroke="#0f172a"
              strokeWidth={2}
            />
            <line
              x1={xScale(averageSide)}
              x2={xScale(averageSide)}
              y1={yScale(averageCarry) - 13}
              y2={yScale(averageCarry) + 13}
              stroke="#0f172a"
              strokeWidth={2}
            />
            <circle
              cx={xScale(averageSide) + 15}
              cy={yScale(averageCarry) - 15}
              r={9}
              fill="#0f172a"
              stroke="white"
              strokeWidth={1.5}
            />
            <text
              x={xScale(averageSide) + 15}
              y={yScale(averageCarry) - 11}
              textAnchor="middle"
              className="fill-white text-[10px] font-bold"
            >
              1
            </text>
          </g>
        </svg>
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>{activeLabel.trim()} dispersion</span>
          <span>{visibleLines.length} recent shots</span>
        </div>
      </div>
      <CorridorSplit buckets={buckets} />
    </div>
  );
}

function CorridorSplit({
  buckets,
}: {
  buckets: ReturnType<typeof buildDispersionCorridorBuckets>;
}) {
  if (buckets.length === 0) return null;
  const total = buckets[0]?.total ?? 0;

  return (
    <div className="rounded-lg border bg-card p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-semibold text-foreground">Corridor split</p>
        <p className="text-[11px] text-muted-foreground">{total} plotted shots</p>
      </div>
      <div
        className={cn("grid gap-1.5", buckets.length === 5 ? "sm:grid-cols-5" : "sm:grid-cols-3")}
      >
        {buckets.map((bucket) => (
          <div
            key={bucket.id}
            className={cn(
              "min-w-0 rounded-md px-2 py-1.5 text-xs",
              corridorBucketClass(bucket.tone),
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{shortCorridorLabel(bucket.id, bucket.label)}</span>
              <span className="shrink-0 text-sm font-semibold">
                {numberFormatter.format(bucket.percent)}%
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-3 opacity-70">
              {formatChartTick(bucket.minYd)} to {formatChartTick(bucket.maxYd)}
              {bucket.tone === "left" ? " L" : bucket.tone === "right" ? " R" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionDeltaTable({ rows }: { rows: SessionDeltaRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyPanel icon={Database} text="Import a simulator session to unlock 30-day deltas." />
    );
  }

  return (
    <div
      id="simulator-session-deltas"
      className="grid scroll-mt-28 gap-3"
      data-workbench-scope="simulator-session-deltas"
    >
      <DesktopTableWorkbenchControls
        viewKey="simulator-session-deltas"
        scope="simulator-session-deltas"
        currentViewLabel="Latest session deltas"
        resultLabel={`${rows.length.toLocaleString("en-GB")} clubs`}
        columns={sessionDeltaColumns}
        suggestedViews={sessionDeltaSuggestedViews}
        exportTableId="simulator-session-deltas"
        exportFileName="forekinghell-simulator-session-deltas.csv"
      />
      <DataTableFrame mainTable mainTableLabel="Simulator session delta table" stickyFirstColumn>
        <Table
          data-workbench-export-table="simulator-session-deltas"
          aria-describedby="simulator-session-deltas-summary"
        >
          <TableCaption id="simulator-session-deltas-summary" className="sr-only">
            Latest simulator session deltas against prior 30-day club baselines.
          </TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead data-column="club" className="sticky left-0 z-20 border-r bg-card">
                Club
              </TableHead>
              <TableHead data-column="samples">Samples</TableHead>
              <TableHead data-column="carry" className="text-right">
                Carry
              </TableHead>
              <TableHead data-column="ball" className="text-right">
                Ball
              </TableHead>
              <TableHead data-column="smash" className="text-right">
                Smash
              </TableHead>
              <TableHead data-column="offline" className="text-right">
                Offline
              </TableHead>
              <TableHead data-column="verdict">Verdict</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.clubType}
                tabIndex={0}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TableCell
                  data-column="club"
                  className="sticky left-0 z-10 border-r bg-card font-medium"
                >
                  <div>{row.clubLabel}</div>
                  <div className="max-w-sm truncate text-xs font-normal text-muted-foreground">
                    {row.summary}
                  </div>
                </TableCell>
                <TableCell data-column="samples">
                  {row.latestShotCount}/{row.baselineShotCount}
                </TableCell>
                <TableCell data-column="carry" className="text-right tabular-nums">
                  {formatDelta(row.carryDeltaYd, "yd")}
                </TableCell>
                <TableCell data-column="ball" className="text-right tabular-nums">
                  {formatDelta(row.ballSpeedDeltaMph, "mph")}
                </TableCell>
                <TableCell data-column="smash" className="text-right tabular-nums">
                  {formatDelta(row.smashDelta, "")}
                </TableCell>
                <TableCell data-column="offline" className="text-right tabular-nums">
                  {formatDelta(row.offlineDeltaYd, "yd")}
                </TableCell>
                <TableCell data-column="verdict" className={toneTextClass(row.tone)}>
                  {verdictLabel(row.verdict)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableFrame>
    </div>
  );
}

function EquipmentImpactTable({ impacts }: { impacts: EquipmentChangeImpact[] }) {
  if (impacts.length === 0) {
    return (
      <EmptyPanel icon={AlertTriangle} text="Log a club setup and retest to prove the change." />
    );
  }

  return (
    <div
      id="simulator-equipment-impact"
      className="grid scroll-mt-28 gap-3"
      data-workbench-scope="simulator-equipment-impact"
    >
      <DesktopTableWorkbenchControls
        viewKey="simulator-equipment-impact"
        scope="simulator-equipment-impact"
        currentViewLabel="Equipment impact"
        resultLabel={`${impacts.length.toLocaleString("en-GB")} changes`}
        columns={equipmentImpactColumns}
        suggestedViews={equipmentImpactSuggestedViews}
        exportTableId="simulator-equipment-impact"
        exportFileName="forekinghell-simulator-equipment-impact.csv"
      />
      <DataTableFrame label="Simulator equipment impact table" stickyFirstColumn>
        <Table
          data-workbench-export-table="simulator-equipment-impact"
          aria-describedby="simulator-equipment-impact-summary"
        >
          <TableCaption id="simulator-equipment-impact-summary" className="sr-only">
            Equipment changes with before and after simulator performance windows.
          </TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead data-column="change" className="sticky left-0 z-20 border-r bg-card">
                Change
              </TableHead>
              <TableHead data-column="samples">Samples</TableHead>
              <TableHead data-column="carry" className="text-right">
                Carry
              </TableHead>
              <TableHead data-column="ball" className="text-right">
                Ball
              </TableHead>
              <TableHead data-column="smash" className="text-right">
                Smash
              </TableHead>
              <TableHead data-column="offline" className="text-right">
                Offline
              </TableHead>
              <TableHead data-column="verdict">Verdict</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {impacts.map((impact) => (
              <TableRow
                key={impact.id}
                tabIndex={0}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TableCell data-column="change" className="sticky left-0 z-10 border-r bg-card">
                  <div className="font-medium">
                    {impact.clubLabel} / {dateFormatter.format(impact.effectiveFrom)}
                  </div>
                  <div className="max-w-sm truncate text-xs text-muted-foreground">
                    {impact.equipmentLabel}
                  </div>
                </TableCell>
                <TableCell data-column="samples">
                  {impact.beforeShotCount}/{impact.afterShotCount}
                </TableCell>
                <TableCell data-column="carry" className="text-right tabular-nums">
                  {formatDelta(impact.carryDeltaYd, "yd")}
                </TableCell>
                <TableCell data-column="ball" className="text-right tabular-nums">
                  {formatDelta(impact.ballSpeedDeltaMph, "mph")}
                </TableCell>
                <TableCell data-column="smash" className="text-right tabular-nums">
                  {formatDelta(impact.smashDelta, "")}
                </TableCell>
                <TableCell data-column="offline" className="text-right tabular-nums">
                  {formatDelta(impact.offlineDeltaYd, "yd")}
                </TableCell>
                <TableCell data-column="verdict" className={toneTextClass(impact.tone)}>
                  {impact.verdict}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableFrame>
    </div>
  );
}

function EmptyPanel({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="apple-panel flex items-center gap-3 rounded-lg p-4 text-sm text-muted-foreground">
      <Icon className="size-5" />
      <span>{text}</span>
      <Button asChild variant="ghost" size="sm" className="ml-auto">
        <Link href="/import" prefetch={false}>
          Open
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

function formatDelta(value: number | null, unit: string) {
  if (value === null) return "--";
  const suffix = unit ? ` ${unit}` : "";
  return `${value >= 0 ? "+" : ""}${numberFormatter.format(value)}${suffix}`;
}

function verdictLabel(value: SessionDeltaRow["verdict"]) {
  if (value === "better") return "Better";
  if (value === "worse") return "Worse";
  if (value === "mixed") return "Mixed";
  return "Building";
}

function toneTextClass(tone: "green" | "sky" | "amber" | "pink" | "slate") {
  return cn(
    "font-medium",
    tone === "green" && "text-[var(--status-success-foreground)]",
    tone === "sky" && "text-[var(--status-information-foreground)]",
    tone === "amber" && "text-[var(--status-warning-foreground)]",
    tone === "pink" && "text-destructive",
    tone === "slate" && "text-muted-foreground",
  );
}

function toneBadgeClass(tone: "green" | "sky" | "amber" | "pink" | "slate") {
  return cn(
    tone === "green" &&
      "bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]",
    tone === "sky" &&
      "bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]",
    tone === "amber" &&
      "bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]",
    tone === "pink" && "bg-[var(--status-error-surface)] text-destructive",
    tone === "slate" && "bg-muted text-muted-foreground",
  );
}

function practicePriorityLabel(tone: "green" | "sky" | "amber" | "pink" | "slate") {
  if (tone === "pink") return "Critical";
  if (tone === "amber" || tone === "sky") return "Recommended";
  if (tone === "green") return "Nice to have";
  return "Building";
}

function costGroupHref(group: CostlyShotGroup) {
  const miss = group.mainMisses.find((item) => item === "Left miss" || item === "Right miss");
  const params = new URLSearchParams({ rangeClub: group.clubType });
  if (miss === "Left miss") params.set("rangeMiss", "left");
  if (miss === "Right miss") params.set("rangeMiss", "right");
  return `/simulator-lab?${params.toString()}#range-reality`;
}

function statusTone(confidence: RangeRealityHandicapData["estimate"]["confidence"]) {
  if (confidence === "high") return "green";
  if (confidence === "medium") return "sky";
  if (confidence === "low") return "amber";
  return "slate";
}

function trendTone(direction: RangeRealityHandicapData["estimate"]["trend"]["direction"]) {
  if (direction === "improving") return "green";
  if (direction === "worse") return "pink";
  if (direction === "flat") return "sky";
  return "slate";
}

function buildReadiness(reality: RangeRealityHandicapData, health: GolfHealth): Readiness {
  const topLeak = reality.costlyShotGroups[0] ?? null;
  const trendBoost =
    reality.estimate.trend.direction === "improving"
      ? 8
      : reality.estimate.trend.direction === "worse"
        ? -10
        : reality.estimate.trend.direction === "flat"
          ? 2
          : -2;
  const confidence = reality.estimate.confidenceScore;
  const score = clampScore(health.overall * 0.58 + confidence * 0.34 + trendBoost);
  const label = score >= 82 ? "Ready" : score >= 68 ? "Solid" : score >= 52 ? "Mixed" : "Fragile";
  const tone = healthTone(score);
  const summary =
    score >= 82
      ? "You are striking it well."
      : score >= 68
        ? "Good enough to trust the plan."
        : score >= 52
          ? "Playable, but one leak stands out."
          : "Keep expectations conservative.";
  const expected =
    reality.estimate.value === null
      ? "Add more range shots before calling today's playing number."
      : topLeak
        ? `${topLeak.clubLabel} still needs attention. Expect to play around ${reality.estimate.label} today.`
        : `No dominant leak. Expect to play around ${reality.estimate.label} today.`;

  return {
    score,
    label,
    summary,
    expected,
    tone,
  };
}

function buildGolfHealth(reality: RangeRealityHandicapData): GolfHealth {
  const driverCost = reality.costlyShotGroups.find((group) => group.clubType === "driver");
  const ironGroups = reality.costlyShotGroups.filter((group) =>
    ["3i", "4i", "5i", "6i", "7i", "8i", "9i", "pw"].includes(group.clubType),
  );
  const trustedWindows = reality.bagTruth.filter((item) => item.confidenceLabel === "High").length;
  const dangerRate =
    reality.flightLines.length > 0
      ? reality.flightLines.filter((line) => line.isDirectionalDamage).length /
        reality.flightLines.length
      : 0.35;
  const targetRate =
    reality.flightLines.length > 0
      ? reality.flightLines.filter((line) => Math.abs(line.sideYd) <= 10).length /
        reality.flightLines.length
      : 0;
  const trendScore =
    reality.estimate.trend.direction === "improving"
      ? 82
      : reality.estimate.trend.direction === "flat"
        ? 68
        : reality.estimate.trend.direction === "worse"
          ? 42
          : 55;
  const driverScore = clampScore(78 - (driverCost?.scoreLossSharePct ?? 18));
  const ironsScore = clampScore(
    76 - ironGroups.reduce((total, group) => total + group.scoreLossSharePct, 0) / 2,
  );
  const distanceScore = clampScore(45 + trustedWindows * 10);
  const dispersionScore = clampScore(92 - dangerRate * 85);
  const consistencyScore = clampScore(trendScore * 0.6 + reality.estimate.confidenceScore * 0.4);
  const scored = [driverScore, ironsScore, distanceScore, dispersionScore, consistencyScore];

  return {
    overall: Math.round(scored.reduce((total, score) => total + score, 0) / scored.length),
    metrics: [
      {
        label: "Putting",
        score: null,
        detail: "Course-only signal",
        tone: "slate",
      },
      {
        label: "Driver",
        score: driverScore,
        detail: driverCost?.detail ?? "No dominant driver leak",
        tone: healthTone(driverScore),
      },
      {
        label: "Irons",
        score: ironsScore,
        detail: `${ironGroups.length} iron groups flagged`,
        tone: healthTone(ironsScore),
      },
      {
        label: "Distance",
        score: distanceScore,
        detail: `${trustedWindows} trusted carry windows`,
        tone: healthTone(distanceScore),
      },
      {
        label: "Dispersion",
        score: dispersionScore,
        detail: `${Math.round(targetRate * 100)}% target corridor`,
        tone: healthTone(dispersionScore),
      },
      {
        label: "Consistency",
        score: consistencyScore,
        detail: reality.estimate.trend.label,
        tone: healthTone(consistencyScore),
      },
    ],
  };
}

function clampScore(value: number) {
  return Math.round(Math.max(10, Math.min(96, value)));
}

function healthTone(score: number): "green" | "sky" | "amber" | "pink" {
  if (score >= 78) return "green";
  if (score >= 64) return "sky";
  if (score >= 48) return "amber";
  return "pink";
}

function healthLabel(score: number) {
  if (score >= 82) return "Excellent";
  if (score >= 68) return "Strong";
  if (score >= 52) return "Developing";
  return "Needs work";
}

function healthBarClass(tone: "green" | "sky" | "amber" | "pink" | "slate") {
  if (tone === "green") return "bg-[var(--status-success-foreground)]";
  if (tone === "sky") return "bg-[var(--status-information-foreground)]";
  if (tone === "amber") return "bg-[var(--status-warning-foreground)]";
  if (tone === "pink") return "bg-destructive";
  return "bg-muted-foreground";
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      asChild
      size="sm"
      variant={active ? "default" : "outline"}
      className="h-8 rounded-lg px-3 text-xs"
    >
      <Link href={href} prefetch={false} aria-current={active ? "page" : undefined}>
        {children}
      </Link>
    </Button>
  );
}

function filterFlightLines(
  lines: RealityFlightLine[],
  rangeClub: string | null,
  rangeMiss: string | null,
) {
  return lines.filter((line) => {
    if (rangeClub && line.clubType !== rangeClub) return false;
    if (rangeMiss === "left") return line.sideYd <= -10;
    if (rangeMiss === "right") return line.sideYd >= 10;
    if (rangeMiss === "danger") return line.isDirectionalDamage;
    return true;
  });
}

function uniqueBy<T, K>(items: T[], keyForItem: (item: T) => K) {
  const seen = new Set<K>();
  const unique: T[] = [];
  for (const item of items) {
    const key = keyForItem(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function missFilterLabel(value: string) {
  if (value === "left") return "left miss";
  if (value === "right") return "right miss";
  if (value === "danger") return "danger";
  return "";
}

function firstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function rangeShapePath({
  line,
  xScale,
  yScale,
}: {
  line: RealityFlightLine;
  xScale: (value: number) => number;
  yScale: (value: number) => number;
}) {
  if (line.carryYd <= 0 || typeof line.launchDirectionDeg !== "number") {
    return `M ${xScale(0)} ${yScale(0)} L ${xScale(line.sideYd)} ${yScale(line.carryYd)}`;
  }

  const theta = (line.launchDirectionDeg * Math.PI) / 180;
  const startSlope = Math.tan(theta);
  const bendCoefficient = (line.sideYd - startSlope * line.carryYd) / (line.carryYd * line.carryYd);

  return Array.from({ length: 41 }, (_, index) => {
    const downrangeYd = line.carryYd * (index / 40);
    const offlineYd = bendCoefficient * downrangeYd * downrangeYd + startSlope * downrangeYd;
    return `${index === 0 ? "M" : "L"} ${xScale(offlineYd)} ${yScale(downrangeYd)}`;
  }).join(" ");
}

function flightLineColor(line: RealityFlightLine) {
  if (line.isDirectionalDamage) return "#e11d48";
  if (!line.included) return "#6b8f78";
  return "#0B7A3B";
}

function niceChartMax(value: number, step: number) {
  return Math.max(step, Math.ceil(value / step) * step);
}

function chartTicks(maxValue: number, count: number) {
  const step = niceChartMax(maxValue / count, 10);
  const values: number[] = [];

  for (let value = 0; value <= maxValue; value += step) {
    values.push(value);
  }

  if (values[values.length - 1] !== maxValue) {
    values.push(maxValue);
  }

  return [...new Set(values)];
}

function formatChartTick(value: number) {
  if (value === 0) return "0";
  return value > 0 ? `+${numberFormatter.format(value)}` : numberFormatter.format(value);
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function shortCorridorLabel(id: string, label: string) {
  if (id === "far-left") return "Far L";
  if (id === "left") return "Left";
  if (id === "right") return "Right";
  if (id === "far-right") return "Far R";
  return label;
}

function corridorBucketClass(tone: "left" | "target" | "right") {
  if (tone === "target") {
    return "bg-[var(--status-success-surface)] text-[var(--status-success-foreground)] ring-1 ring-[var(--status-success-border)]";
  }

  if (tone === "left") {
    return "bg-[var(--status-error-surface)] text-destructive";
  }

  return "bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]";
}
