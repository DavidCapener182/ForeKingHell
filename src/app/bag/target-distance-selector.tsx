"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Fragment, useMemo, useState } from "react";
import { ChevronRight, Lightbulb, Minus, Plus, ShieldCheck, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatClubType } from "@/lib/club-format";

export type TargetDistanceRow = {
  id: string;
  clubType: string;
  carryYd: number | null;
  latestReliableCarryYd?: number | null;
  playNumberYd: number | null;
  sampleSize: number;
  confidenceScore: number;
  shotRole?: "stock" | "touch";
  touchMinYd?: number | null;
  touchMedianYd?: number | null;
  touchMaxYd?: number | null;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const TARGET_PRESETS = [120, 150, 175, 200, 300];
const MIN_TARGET_YD = 40;
const MAX_TARGET_YD = 650;
const STEP_YD = 5;
const TARGET_DISTANCE_IMAGE_SRC = "/assets/generated/target-distance-fairway-panel.png";
type PlayableTargetRow = TargetDistanceRow & {
  carryYd: number;
  playNumberYd: number;
};

type PlannedShot = {
  row: PlayableTargetRow;
  desiredYd: number;
  plannedYd: number;
  fullShotDeltaYd: number;
  leaveYdAfterShot: number;
};

type ShotPlan = {
  routeKey: string;
  shots: PlannedShot[];
  expectedYd: number;
  missYd: number;
  lowestTrust: number;
};

type PlanTone = "green" | "amber" | "slate";

function formatMetric(value: number | null | undefined) {
  return value === null || value === undefined ? "--" : numberFormatter.format(value);
}

function clampTarget(value: number) {
  if (!Number.isFinite(value)) {
    return 150;
  }

  return Math.min(MAX_TARGET_YD, Math.max(MIN_TARGET_YD, Math.round(value)));
}

function isDriver(row: TargetDistanceRow) {
  return row.clubType.toLowerCase().includes("driver");
}

function isTouchRow(row: TargetDistanceRow) {
  return row.shotRole === "touch";
}

function getTouchMaxYd(row: TargetDistanceRow) {
  return row.touchMaxYd ?? row.playNumberYd ?? row.carryYd;
}

function getPlannedYards(row: PlayableTargetRow, targetYd: number) {
  if (isTouchRow(row)) {
    const touchMaxYd = getTouchMaxYd(row);

    if (touchMaxYd !== null && touchMaxYd !== undefined && targetYd <= touchMaxYd) {
      return targetYd;
    }
  }

  return row.playNumberYd;
}

function buildShotPlanOptions(rows: PlayableTargetRow[], targetYd: number): ShotPlan[] {
  if (rows.length === 0) {
    return [];
  }

  const byDistance = [...rows].sort(
    (left, right) =>
      right.playNumberYd - left.playNumberYd || right.confidenceScore - left.confidenceScore,
  );
  const longest = byDistance.find((row) => !isTouchRow(row)) ?? byDistance[0];
  const routeOptions = new Map<string, PlayableTargetRow[]>();
  const addRoute = (route: PlayableTargetRow[]) => {
    const routeKey = getRouteKey(route);

    if (!routeOptions.has(routeKey)) {
      routeOptions.set(routeKey, route);
    }
  };

  if (targetYd <= longest.playNumberYd) {
    for (const row of byDistance) {
      addRoute([row]);
    }
  } else {
    const approachRows = byDistance.filter((row) => !isDriver(row));
    const pool = approachRows.length > 0 ? approachRows : byDistance;

    for (const secondShot of pool) {
      addRoute([longest, secondShot]);

      for (const thirdShot of pool) {
        if (thirdShot.id === secondShot.id) {
          continue;
        }

        addRoute([longest, secondShot, thirdShot]);
      }
    }
  }

  return [...routeOptions.values()]
    .map((route) => buildShotPlanFromRoute(route, targetYd))
    .sort(compareShotPlans);
}

function buildShotPlanFromRoute(route: PlayableTargetRow[], targetYd: number): ShotPlan {
  let coveredYd = 0;
  const shots = route.map((row) => {
    const remainingBeforeShotYd = Math.max(0, Math.round((targetYd - coveredYd) * 10) / 10);
    const desiredYd = remainingBeforeShotYd;
    const plannedYd = getPlannedYards(row, desiredYd);
    const fullShotDeltaYd = Math.round((plannedYd - desiredYd) * 10) / 10;
    coveredYd += plannedYd;
    const leaveYdAfterShot = Math.max(0, Math.round((targetYd - coveredYd) * 10) / 10);

    return {
      row,
      desiredYd,
      plannedYd,
      fullShotDeltaYd,
      leaveYdAfterShot,
    };
  });

  const expectedYd = Math.round(coveredYd * 10) / 10;
  const missYd = Math.round((expectedYd - targetYd) * 10) / 10;
  const lowestTrust = Math.min(...route.map((row) => row.confidenceScore));

  return {
    routeKey: getRouteKey(route),
    shots,
    expectedYd,
    missYd,
    lowestTrust,
  };
}

function getRouteKey(route: PlayableTargetRow[]) {
  return route.map((row) => row.id).join(">");
}

function compareShotPlans(left: ShotPlan, right: ShotPlan) {
  const missComparison = Math.abs(left.missYd) - Math.abs(right.missYd);

  if (missComparison !== 0) {
    return missComparison;
  }

  const shotCountComparison = left.shots.length - right.shots.length;

  if (shotCountComparison !== 0) {
    return shotCountComparison;
  }

  return right.lowestTrust - left.lowestTrust;
}

function formatShotAdjustment(row: TargetDistanceRow, value: number) {
  if (Math.abs(value) <= 4) {
    return isTouchRow(row) ? "Touch window fits" : "Full swing fits";
  }

  if (isTouchRow(row)) {
    return value > 0
      ? `Touch ${formatMetric(value)} yd less`
      : `Needs ${formatMetric(Math.abs(value))} yd more`;
  }

  return value > 0
    ? `Take ${formatMetric(value)} yd off`
    : `Needs ${formatMetric(Math.abs(value))} yd more`;
}

function getPlanTone(plan: ShotPlan | null): PlanTone {
  if (!plan) {
    return "slate";
  }

  return Math.abs(plan.missYd) <= 4 ? "green" : Math.abs(plan.missYd) <= 15 ? "amber" : "slate";
}

function getRiskLevel(plan: ShotPlan | null) {
  if (!plan) {
    return "--";
  }

  const missYd = Math.abs(plan.missYd);
  if (missYd <= 4) {
    return "Low";
  }

  return missYd <= 15 ? "Medium" : "High";
}

function getWindowQuality(plan: ShotPlan | null) {
  if (!plan) {
    return "--";
  }

  const missYd = Math.abs(plan.missYd);
  if (missYd <= 4) {
    return "Optimal";
  }

  return missYd <= 15 ? "Playable" : "Check";
}

function formatPlanMiss(plan: ShotPlan) {
  if (Math.abs(plan.missYd) <= 4) {
    return "On number";
  }

  return plan.missYd > 0
    ? `${formatMetric(plan.missYd)} yd long`
    : `${formatMetric(Math.abs(plan.missYd))} yd short`;
}

function formatRouteTitle(plan: ShotPlan) {
  return plan.shots.map((shot) => formatClubType(shot.row.clubType)).join(" + ");
}

function getShotLabel(row: TargetDistanceRow, index: number, totalShots: number) {
  if (isTouchRow(row)) {
    return "Touch";
  }

  if (totalShots > 1 && index === 0) {
    return "Tee shot";
  }

  return index === 0 ? "Stock pick" : "Approach";
}

function getShotDetail(shot: PlannedShot, index: number, isMultiShotPlan: boolean) {
  if (isMultiShotPlan && shot.leaveYdAfterShot > 0 && index < 2) {
    return `Plays ${formatMetric(shot.plannedYd)} yd · leaves ${formatMetric(
      shot.leaveYdAfterShot,
    )} yd`;
  }

  return `Need ${formatMetric(shot.desiredYd)} yd · ${formatShotAdjustment(
    shot.row,
    shot.fullShotDeltaYd,
  )}`;
}

function getShotDetailParts(shot: PlannedShot, index: number, isMultiShotPlan: boolean) {
  const [primary, secondary] = getShotDetail(shot, index, isMultiShotPlan).split(" · ");

  return {
    primary,
    secondary,
  };
}

const planMetricSoftToneClasses: Record<PlanTone, string> = {
  green: "text-[var(--status-success-foreground)]",
  amber: "text-[var(--status-warning-foreground)]",
  slate: "text-foreground",
};

const planBadgeToneClasses: Record<PlanTone, string> = {
  green:
    "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]",
  amber:
    "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]",
  slate: "border-border bg-muted text-muted-foreground",
};

function SummaryMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  tone?: PlanTone;
}) {
  return (
    <div className="min-w-0 border-border px-4 first:pl-0 last:pr-0 sm:border-l sm:first:border-l-0">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold ${planMetricSoftToneClasses[tone]}`}>{value}</p>
    </div>
  );
}

export function TargetDistanceSelector({
  rows,
  initialTargetYd = 150,
}: {
  rows: TargetDistanceRow[];
  initialTargetYd?: number;
}) {
  const [targetYd, setTargetYd] = useState(() => clampTarget(initialTargetYd));

  const playableRows = useMemo(
    () =>
      rows
        .filter(
          (
            row,
          ): row is TargetDistanceRow & {
            carryYd: number;
            playNumberYd: number;
          } => row.carryYd !== null && row.playNumberYd !== null,
        )
        .sort(
          (left, right) =>
            right.playNumberYd - left.playNumberYd || right.confidenceScore - left.confidenceScore,
        ),
    [rows],
  );

  const planOptions = useMemo(
    () => buildShotPlanOptions(playableRows, targetYd),
    [playableRows, targetYd],
  );
  const plan = planOptions[0] ?? null;
  const isMultiShotPlan = Boolean(plan && plan.shots.length > 1);
  const planTitle = plan ? formatRouteTitle(plan) : "--";
  const alternatives = planOptions
    .filter((option) => option.routeKey !== plan?.routeKey)
    .slice(0, 3);
  const description = "Pick the safest club for today’s number.";
  const planTone = getPlanTone(plan);
  const riskLevel = getRiskLevel(plan);
  const windowQuality = getWindowQuality(plan);

  function selectTarget(value: number) {
    setTargetYd(clampTarget(value));
  }

  return (
    <section
      data-target-distance-selector
      className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 pb-5 pt-6">
        <div className="flex items-center gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
            <Target className="size-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-normal text-foreground">
              Target distance selector
            </h2>
            <p className="mt-1 text-base text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-6 pb-6 lg:grid-cols-[minmax(430px,0.95fr)_minmax(0,1.6fr)] lg:items-stretch xl:grid-cols-[minmax(560px,0.95fr)_minmax(0,1.8fr)]">
        <div className="relative min-h-[560px] overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
          <Image
            src={TARGET_DISTANCE_IMAGE_SRC}
            alt=""
            fill
            priority={false}
            sizes="(min-width: 1280px) 460px, (min-width: 768px) 42vw, 100vw"
            className="scale-[1.03] object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-card/95 via-card/75 to-card/0" />
          <div className="absolute inset-x-0 top-0 h-[390px] bg-card/70 [mask-image:linear-gradient(to_bottom,black_0%,black_64%,transparent_100%)]" />
          <div className="relative z-10 flex min-h-[560px] flex-col p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Hole / target
              </p>
              <p className="mt-2 text-6xl font-semibold tracking-normal text-foreground">
                {targetYd}
                <span className="ml-2 text-3xl text-muted-foreground">yd</span>
              </p>
            </div>

            <div
              className="mt-7 grid w-full grid-cols-3 gap-3 sm:grid-cols-5"
              aria-label="Target distance presets"
            >
              {TARGET_PRESETS.map((distance) => (
                <Button
                  key={distance}
                  type="button"
                  size="sm"
                  variant={distance === targetYd ? "default" : "outline"}
                  aria-pressed={distance === targetYd}
                  className="h-11 rounded-full px-3 text-sm font-semibold shadow-sm"
                  onClick={() => selectTarget(distance)}
                >
                  {distance} yd
                </Button>
              ))}
            </div>

            <Field className="mt-8 max-w-sm">
              <FieldLabel htmlFor="target-distance-yards">Type hole yards</FieldLabel>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-12 rounded-full text-primary shadow-sm"
                  aria-label="Reduce target distance by 5 yards"
                  onClick={() => selectTarget(targetYd - STEP_YD)}
                >
                  <Minus className="size-5" />
                </Button>
                <div className="relative">
                  <Input
                    id="target-distance-yards"
                    name="targetDistanceYards"
                    type="number"
                    inputMode="numeric"
                    min={MIN_TARGET_YD}
                    max={MAX_TARGET_YD}
                    step={STEP_YD}
                    value={targetYd}
                    suppressHydrationWarning
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => selectTarget(Number(event.target.value))}
                    className="h-14 w-36 px-5 pr-12 text-xl font-semibold shadow-sm"
                  />
                  <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    yd
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-12 rounded-full text-primary shadow-sm"
                  aria-label="Increase target distance by 5 yards"
                  onClick={() => selectTarget(targetYd + STEP_YD)}
                >
                  <Plus className="size-5" />
                </Button>
              </div>
            </Field>
            <div className="mt-auto min-h-36" />
          </div>
        </div>

        <div className="flex min-h-[560px] flex-col gap-5">
          <div className="flex flex-1 flex-col rounded-2xl border border-border bg-muted/20 p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-primary">
                  {isMultiShotPlan ? "Recommended route" : "Recommended"}
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
                  {planTitle}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`gap-2 px-4 py-2 ${planBadgeToneClasses[planTone]}`}
              >
                <ShieldCheck className="size-4" />
                {plan ? `${plan.lowestTrust}% lowest trust` : "Needs data"}
              </Badge>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm sm:grid-cols-4">
              <SummaryMetric
                label="Planned total"
                value={plan ? `${formatMetric(plan.expectedYd)} yd` : "--"}
                tone="green"
              />
              <SummaryMetric label="Risk" value={riskLevel} tone={planTone} />
              <SummaryMetric label="Matched window" value={windowQuality} tone={planTone} />
              <SummaryMetric
                label="Sample"
                value={
                  plan
                    ? `${plan.shots.reduce((total, shot) => total + shot.row.sampleSize, 0)} shots`
                    : "--"
                }
              />
            </div>

            {plan && plan.shots.length > 0 ? (
              <div className="mt-7 flex flex-col gap-3 xl:flex-row xl:items-center">
                {plan.shots.map((shot, index) => {
                  const detail = getShotDetailParts(shot, index, isMultiShotPlan);

                  return (
                    <Fragment key={`${shot.row.id}-${index}`}>
                      <Link
                        href={`/bag/${shot.row.id}`}
                        prefetch={false}
                        className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4 text-sm shadow-sm transition hover:border-primary/40 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                              {index + 1}
                            </span>
                            <p className="truncate text-lg font-semibold text-foreground">
                              <span className="block text-xs font-medium text-muted-foreground">
                                {getShotLabel(shot.row, index, plan.shots.length)}
                              </span>
                              <span className="block truncate">
                                {formatClubType(shot.row.clubType)}
                              </span>
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 bg-card px-3 py-1">
                            {formatMetric(shot.plannedYd)} yd
                            {isTouchRow(shot.row) ? " touch" : ""}
                          </Badge>
                        </div>
                        <div className="mt-4 text-base text-muted-foreground">
                          <p>{detail.primary}</p>
                          {detail.secondary ? (
                            <p className="mt-1 pl-3 before:mr-2 before:content-['•']">
                              {detail.secondary}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                      {index < plan.shots.length - 1 ? (
                        <ChevronRight className="hidden size-6 shrink-0 text-muted-foreground xl:block" />
                      ) : null}
                    </Fragment>
                  );
                })}
              </div>
            ) : null}

            {alternatives.length > 0 ? (
              <div className="mt-7">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-border" />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Alternative routes
                  </p>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {alternatives.map((alternative) => {
                    const finalShot = alternative.shots[alternative.shots.length - 1];
                    const alternativeTone = getPlanTone(alternative);

                    return (
                      <Link
                        key={alternative.routeKey}
                        href={`/bag/${finalShot.row.id}`}
                        prefetch={false}
                        className="rounded-xl border border-border bg-card p-5 text-sm shadow-sm transition hover:border-primary/40 hover:shadow-md"
                      >
                        <p className="truncate text-xl font-semibold text-foreground">
                          {formatRouteTitle(alternative)}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                              Total
                            </p>
                            <p className="mt-1 font-semibold text-foreground">
                              {formatMetric(alternative.expectedYd)} yd
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                              Result
                            </p>
                            <p
                              className={`mt-1 font-semibold ${planMetricSoftToneClasses[alternativeTone]}`}
                            >
                              {formatPlanMiss(alternative)}
                            </p>
                          </div>
                        </div>
                        <p className="mt-4 text-base text-muted-foreground">
                          {alternative.lowestTrust}% lowest trust
                        </p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.max(8, Math.min(100, alternative.lowestTrust))}%`,
                            }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Lightbulb className="size-5 text-primary" />
              <p>
                <span className="font-semibold text-foreground">Tip:</span> Wind, elevation and lie
                can affect distances. Review your conditions before committing.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
              Learn more
              <ChevronRight className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
