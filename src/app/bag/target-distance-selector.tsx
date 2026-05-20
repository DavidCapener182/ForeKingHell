"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Minus, Plus, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { DataPair, DataPanel, SectionHeader, StatusPill } from "@/components/premium";
import { formatClubType } from "@/lib/club-format";

export type TargetDistanceRow = {
  id: string;
  clubType: string;
  carryYd: number | null;
  playNumberYd: number | null;
  sampleSize: number;
  confidenceScore: number;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const TARGET_PRESETS = [120, 150, 175, 200, 300];
const MIN_TARGET_YD = 40;
const MAX_TARGET_YD = 650;
const STEP_YD = 5;
const MULTI_SHOT_BUFFER_YD = 20;
const SHORT_REMAINING_YD = 45;

type PlayableTargetRow = TargetDistanceRow & {
  carryYd: number;
  playNumberYd: number;
};

type PlannedShot = {
  row: PlayableTargetRow;
  desiredYd: number;
  fullShotDeltaYd: number;
  leaveYdAfterShot: number;
};

type ShotPlan = {
  shots: PlannedShot[];
  expectedYd: number;
  missYd: number;
  lowestTrust: number;
};

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

function chooseClosestClub(rows: PlayableTargetRow[], targetYd: number) {
  return [...rows].sort(
    (left, right) =>
      Math.abs(left.playNumberYd - targetYd) - Math.abs(right.playNumberYd - targetYd) ||
      right.confidenceScore - left.confidenceScore,
  )[0];
}

function buildShotPlan(rows: PlayableTargetRow[], targetYd: number): ShotPlan | null {
  if (rows.length === 0) {
    return null;
  }

  const byDistance = [...rows].sort(
    (left, right) =>
      right.playNumberYd - left.playNumberYd || right.confidenceScore - left.confidenceScore,
  );
  const longest = byDistance[0];
  const bestSingle = chooseClosestClub(rows, targetYd);

  const route =
    targetYd <= longest.playNumberYd + MULTI_SHOT_BUFFER_YD
      ? [bestSingle]
      : buildMultiShotRoute(byDistance, targetYd);

  let coveredYd = 0;
  const shots = route.map((row, index) => {
    const remainingBeforeShotYd = Math.max(0, Math.round((targetYd - coveredYd) * 10) / 10);
    const desiredYd = route.length > 1 && index === 0 ? row.playNumberYd : remainingBeforeShotYd;
    const fullShotDeltaYd = Math.round((row.playNumberYd - desiredYd) * 10) / 10;
    coveredYd += row.playNumberYd;
    const leaveYdAfterShot = Math.max(0, Math.round((targetYd - coveredYd) * 10) / 10);

    return {
      row,
      desiredYd,
      fullShotDeltaYd,
      leaveYdAfterShot,
    };
  });

  const expectedYd = Math.round(coveredYd * 10) / 10;
  const missYd = Math.round((expectedYd - targetYd) * 10) / 10;
  const lowestTrust = Math.min(...route.map((row) => row.confidenceScore));

  return {
    shots,
    expectedYd,
    missYd,
    lowestTrust,
  };
}

function buildMultiShotRoute(rowsByDistance: PlayableTargetRow[], targetYd: number) {
  const longest = rowsByDistance[0];
  const approachRows = rowsByDistance.filter((row) => !isDriver(row));
  const route: PlayableTargetRow[] = [longest];
  let remainingYd = targetYd - longest.playNumberYd;

  while (remainingYd > SHORT_REMAINING_YD && route.length < 3) {
    const pool = approachRows.length > 0 ? approachRows : rowsByDistance;
    const nextClub = chooseClosestClub(pool, remainingYd);

    if (!nextClub) {
      break;
    }

    route.push(nextClub);
    remainingYd = Math.round((remainingYd - nextClub.playNumberYd) * 10) / 10;
  }

  return route;
}

function formatMiss(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "--";
  }

  if (Math.abs(value) <= 4) {
    return "Matched window";
  }

  return value > 0 ? `${formatMetric(value)} yd long` : `${formatMetric(Math.abs(value))} yd short`;
}

function formatShotAdjustment(value: number) {
  if (Math.abs(value) <= 4) {
    return "Full swing fits";
  }

  return value > 0
    ? `Take ${formatMetric(value)} yd off`
    : `Needs ${formatMetric(Math.abs(value))} yd more`;
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

  const candidates = useMemo(
    () =>
      [...playableRows].sort(
        (left, right) =>
          Math.abs(left.playNumberYd - targetYd) - Math.abs(right.playNumberYd - targetYd) ||
          right.confidenceScore - left.confidenceScore,
      ),
    [playableRows, targetYd],
  );

  const plan = useMemo(() => buildShotPlan(playableRows, targetYd), [playableRows, targetYd]);
  const isMultiShotPlan = Boolean(plan && plan.shots.length > 1);
  const planTitle = plan
    ? plan.shots.map((shot) => formatClubType(shot.row.clubType)).join(" + ")
    : "--";
  const alternatives = candidates
    .filter((row) => plan?.shots.every((shot) => shot.row.id !== row.id) ?? true)
    .slice(0, 3);
  const description =
    plan && isMultiShotPlan
      ? `Plan ${targetYd} yd as a hole distance: start with ${formatClubType(
          plan.shots[0].row.clubType,
        )}, then match the remaining number.`
      : `I need ${targetYd} yd: pick the club with the closest play number and enough trust to use on course.`;
  const missText = formatMiss(plan?.missYd);

  function selectTarget(value: number) {
    setTargetYd(clampTarget(value));
  }

  return (
    <DataPanel>
      <SectionHeader
        title="Target distance selector"
        description={description}
        action={<Target className="size-5 text-emerald-600" />}
      />
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border bg-[#F5F6F4] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
            Hole / target
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-normal">{targetYd} yd</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Target distance presets">
            {TARGET_PRESETS.map((distance) => (
              <Button
                key={distance}
                type="button"
                size="sm"
                variant={distance === targetYd ? "default" : "outline"}
                aria-pressed={distance === targetYd}
                className="h-8 rounded-full px-3"
                onClick={() => selectTarget(distance)}
              >
                {distance} yd
              </Button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 rounded-full"
              aria-label="Reduce target distance by 5 yards"
              onClick={() => selectTarget(targetYd - STEP_YD)}
            >
              <Minus className="size-4" />
            </Button>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-600">Type hole yards</span>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_TARGET_YD}
                max={MAX_TARGET_YD}
                step={STEP_YD}
                value={targetYd}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => selectTarget(Number(event.target.value))}
                className="h-9 w-32 rounded-lg border border-[#D7DEE8] bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 rounded-full"
              aria-label="Increase target distance by 5 yards"
              onClick={() => selectTarget(targetYd + STEP_YD)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  {isMultiShotPlan ? "Recommended route" : "Recommended"}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-normal">{planTitle}</p>
              </div>
              <StatusPill tone={plan && plan.lowestTrust >= 70 ? "green" : "amber"}>
                {plan ? `${plan.lowestTrust}% lowest trust` : "Needs data"}
              </StatusPill>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <DataPair
                label={isMultiShotPlan ? "Full-shot total" : "Play number"}
                value={plan ? `${formatMetric(plan.expectedYd)} yd` : "--"}
              />
              <DataPair label="Risk" value={missText} />
              <DataPair
                label="Sample"
                value={
                  plan
                    ? `${plan.shots.reduce((total, shot) => total + shot.row.sampleSize, 0)} shots`
                    : "--"
                }
              />
            </div>
            {plan && plan.shots.length > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {plan.shots.map((shot, index) => (
                  <Link
                    key={`${shot.row.id}-${index}`}
                    href={`/bag/${shot.row.id}`}
                    prefetch={false}
                    className="rounded-lg border bg-[#F8FAFC] p-3 text-sm hover:border-emerald-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">
                        {index + 1}. {formatClubType(shot.row.clubType)}
                      </p>
                      <Badge variant="outline">{formatMetric(shot.row.playNumberYd)} yd</Badge>
                    </div>
                    {isMultiShotPlan && index === 0 ? (
                      <p className="mt-2 text-muted-foreground">
                        Plays {formatMetric(shot.row.playNumberYd)} yd · leaves{" "}
                        {formatMetric(shot.leaveYdAfterShot)} yd
                      </p>
                    ) : (
                      <p className="mt-2 text-muted-foreground">
                        Need {formatMetric(shot.desiredYd)} yd ·{" "}
                        {formatShotAdjustment(shot.fullShotDeltaYd)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {alternatives.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {alternatives.map((row) => (
                <Link
                  key={row.id}
                  href={`/bag/${row.id}`}
                  prefetch={false}
                  className="rounded-lg border bg-white p-3 text-sm hover:border-emerald-300"
                >
                  <p className="font-semibold">{formatClubType(row.clubType)}</p>
                  <p className="mt-1 text-muted-foreground">
                    {formatMetric(row.playNumberYd)} yd · {row.confidenceScore}% trust
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <Badge variant="outline" className="w-fit">
              Import more mapped shots to compare alternatives
            </Badge>
          )}
        </div>
      </CardContent>
    </DataPanel>
  );
}
