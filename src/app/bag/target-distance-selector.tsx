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

const TARGET_PRESETS = [120, 150, 175, 200];
const MIN_TARGET_YD = 40;
const MAX_TARGET_YD = 260;
const STEP_YD = 5;

function formatMetric(value: number | null | undefined) {
  return value === null || value === undefined ? "--" : numberFormatter.format(value);
}

function clampTarget(value: number) {
  if (!Number.isFinite(value)) {
    return 150;
  }

  return Math.min(MAX_TARGET_YD, Math.max(MIN_TARGET_YD, Math.round(value)));
}

export function TargetDistanceSelector({
  rows,
  initialTargetYd = 150,
}: {
  rows: TargetDistanceRow[];
  initialTargetYd?: number;
}) {
  const [targetYd, setTargetYd] = useState(() => clampTarget(initialTargetYd));

  const candidates = useMemo(
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
            Math.abs(left.playNumberYd - targetYd) - Math.abs(right.playNumberYd - targetYd) ||
            right.confidenceScore - left.confidenceScore,
        ),
    [rows, targetYd],
  );

  const recommended = candidates[0] ?? null;
  const alternatives = candidates.slice(1, 4);
  const missYd = recommended ? Math.round((recommended.playNumberYd - targetYd) * 10) / 10 : null;
  const risk =
    missYd === null
      ? "Need stock carry samples"
      : Math.abs(missYd) <= 4
        ? "Matched window"
        : missYd > 0
          ? `${formatMetric(missYd)} yd long`
          : `${formatMetric(Math.abs(missYd))} yd short`;

  function selectTarget(value: number) {
    setTargetYd(clampTarget(value));
  }

  return (
    <DataPanel>
      <SectionHeader
        title="Target distance selector"
        description={`I need ${targetYd} yd: pick the club with the closest play number and enough trust to use on course.`}
        action={<Target className="size-5 text-emerald-600" />}
      />
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border bg-[#F5F6F4] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Target</p>
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
              <span className="text-xs font-medium text-slate-600">Custom yards</span>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_TARGET_YD}
                max={MAX_TARGET_YD}
                step={STEP_YD}
                value={targetYd}
                onChange={(event) => selectTarget(Number(event.target.value))}
                className="h-9 w-28 rounded-lg border border-[#D7DEE8] bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                <p className="text-sm text-muted-foreground">Recommended</p>
                <p className="mt-1 text-2xl font-semibold tracking-normal">
                  {recommended ? formatClubType(recommended.clubType) : "--"}
                </p>
              </div>
              <StatusPill
                tone={recommended && recommended.confidenceScore >= 70 ? "green" : "amber"}
              >
                {recommended ? `${recommended.confidenceScore}% trust` : "Needs data"}
              </StatusPill>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <DataPair
                label="Play number"
                value={recommended ? `${formatMetric(recommended.playNumberYd)} yd` : "--"}
              />
              <DataPair label="Risk" value={risk} />
              <DataPair
                label="Sample"
                value={recommended ? `${recommended.sampleSize} shots` : "--"}
              />
            </div>
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
