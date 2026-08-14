"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  getClubBenchmarkMetricLevels,
  getClubSpeedBenchmarkTarget,
  type ClubSpeedBenchmarkTarget,
} from "@/lib/club-benchmarks";
import type { FutureBagProjectionRow } from "@/lib/speed-training-data";
import { cn } from "@/lib/utils";

type FutureBagSliderProps = {
  rows: FutureBagProjectionRow[];
  targetSpeedMph: number | null;
  selectedClubId?: string | null;
};

type SelectedSpeedModel = {
  baselineSpeed: number;
  defaultSpeed: number;
  minSpeed: number;
  maxSpeed: number;
};

export function FutureBagSlider({ rows, targetSpeedMph, selectedClubId }: FutureBagSliderProps) {
  const defaultSelectedClubId = useMemo(() => {
    if (selectedClubId && rows.some((row) => row.clubId === selectedClubId)) {
      return selectedClubId;
    }

    return rows.find((row) => row.clubType === "driver")?.clubId ?? rows[0]?.clubId ?? "all";
  }, [rows, selectedClubId]);
  const [activeClubId, setActiveClubId] = useState(defaultSelectedClubId);

  const [selectedSpeedsByClub, setSelectedSpeedsByClub] = useState<Record<string, number>>({});
  const selectedRow = useMemo(
    () => rows.find((row) => row.clubId === activeClubId) ?? null,
    [rows, activeClubId],
  );
  const selectedSpeedModel = useMemo(
    () => (selectedRow ? buildSelectedSpeedModel(selectedRow, targetSpeedMph) : null),
    [selectedRow, targetSpeedMph],
  );
  const storedSelectedSpeed = selectedRow ? selectedSpeedsByClub[selectedRow.clubId] : undefined;
  const selectedClubSpeed =
    selectedRow && selectedSpeedModel
      ? clampSliderSpeed(storedSelectedSpeed ?? selectedSpeedModel.defaultSpeed, selectedSpeedModel)
      : null;
  const selectedSpeedBenchmark =
    selectedRow && selectedClubSpeed !== null
      ? getClubSpeedBenchmarkTarget(selectedRow.clubType, selectedClubSpeed)
      : null;
  const isOverview = activeClubId === "all";
  const displayedRows = useMemo(() => {
    if (isOverview) {
      return rows;
    }

    return selectedRow ? [selectedRow] : [];
  }, [isOverview, rows, selectedRow]);
  const maxCarryScale = Math.max(
    1,
    ...rows.map((row) => row.currentCarryYd),
    selectedRow && selectedSpeedModel && selectedClubSpeed !== null
      ? projectedCarry(
          selectedRow.currentCarryYd,
          selectedRow.carryGainPerMph,
          selectedClubSpeed - selectedSpeedModel.baselineSpeed,
        )
      : 0,
  );

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-border/70 bg-card/65 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isOverview || !selectedRow
                ? "Future Bag"
                : `Target ${shortClubLabel(selectedRow)} speed`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOverview
                ? "Current bag view. Select one club to model its own speed gain."
                : "One club at a time. Driver speed changes are not applied to the rest of the bag."}
            </p>
          </div>
          {selectedClubSpeed !== null ? (
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums tracking-normal text-foreground">
                {selectedClubSpeed} mph
              </p>
              {selectedSpeedBenchmark ? (
                <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-semibold",
                      speedBenchmarkBadgeClass(selectedSpeedBenchmark.currentLevelKey),
                    )}
                  >
                    {speedLevelLabel(selectedSpeedBenchmark)}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    {speedLevelDetail(selectedSpeedBenchmark)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-lg font-semibold text-muted-foreground">Select a club</p>
          )}
        </div>
        {selectedRow && selectedSpeedModel && selectedClubSpeed !== null ? (
          <>
            <Slider
              aria-label={`Target ${shortClubLabel(selectedRow)} speed`}
              min={selectedSpeedModel.minSpeed}
              max={selectedSpeedModel.maxSpeed}
              step={0.1}
              value={[selectedClubSpeed]}
              onValueChange={([value]) => {
                const nextSpeed = value ?? selectedClubSpeed;

                setSelectedSpeedsByClub((current) => ({
                  ...current,
                  [selectedRow.clubId]: nextSpeed,
                }));
              }}
              className="mt-4"
            />
            <div className="mt-2 flex justify-between text-xs font-medium text-muted-foreground">
              <span>{formatSliderSpeed(selectedSpeedModel.minSpeed)} mph current avg</span>
              <span>{formatSliderSpeed(selectedSpeedModel.maxSpeed)} mph Tour</span>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground">
            Select a club with shot-speed data to model a realistic carry change.
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-1">
        <ToggleGroup
          type="single"
          value={activeClubId}
          onValueChange={(value) => value && setActiveClubId(value)}
          variant="outline"
          spacing={2}
          aria-label="Future bag club filter"
          className="min-w-max"
        >
          <ToggleGroupItem value="all" className="h-8 px-2.5 text-xs">
            All clubs
          </ToggleGroupItem>
          {rows.map((row) => (
            <ToggleGroupItem
              key={row.clubId}
              value={row.clubId}
              aria-label={`Show ${shortClubLabel(row)} future bag projection`}
              className="h-8 max-w-[180px] justify-start overflow-hidden px-2.5 text-xs"
            >
              <span className="truncate">{shortClubLabel(row)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-2">
        {displayedRows.map((row) => {
          const rowSpeedModel =
            !isOverview && row.clubId === selectedRow?.clubId ? selectedSpeedModel : null;
          const rowSelectedSpeed =
            rowSpeedModel && selectedClubSpeed !== null ? selectedClubSpeed : null;
          const clubSpeedDelta =
            rowSpeedModel && rowSelectedSpeed !== null
              ? rowSelectedSpeed - rowSpeedModel.baselineSpeed
              : 0;
          const projected = projectedCarry(row.currentCarryYd, row.carryGainPerMph, clubSpeedDelta);
          const carryGain = projected - row.currentCarryYd;
          const currentCarryPercent = carryScalePercent(row.currentCarryYd, maxCarryScale);
          const projectedCarryPercent = carryScalePercent(projected, maxCarryScale);
          const carryDeltaLeft = Math.min(currentCarryPercent, projectedCarryPercent);
          const carryDeltaWidth = Math.abs(projectedCarryPercent - currentCarryPercent);
          const projectedClubSpeed =
            rowSpeedModel && rowSelectedSpeed !== null ? rowSelectedSpeed : row.currentClubSpeedMph;
          const projectedSpeedBenchmark =
            projectedClubSpeed !== null
              ? getClubSpeedBenchmarkTarget(row.clubType, projectedClubSpeed)
              : null;

          return (
            <div
              key={row.clubId}
              className="rounded-lg border border-border/70 bg-card/65 px-3 py-2"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{row.clubLabel}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.currentCarryYd} yd now ·{" "}
                    {row.currentClubSpeedMph === null
                      ? "club speed n/a"
                      : carryGain === 0
                        ? `${row.currentClubSpeedMph.toFixed(1)} mph current`
                        : `${row.currentClubSpeedMph.toFixed(1)} → ${projectedClubSpeed?.toFixed(
                            1,
                          )} mph`}
                    {projectedSpeedBenchmark
                      ? ` · ${speedLevelLabel(projectedSpeedBenchmark)}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {projected} yd
                  </p>
                  {projectedSpeedBenchmark ? (
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {speedLevelDetail(projectedSpeedBenchmark)}
                    </p>
                  ) : null}
                </div>
                <p className="w-14 text-right text-xs font-medium tabular-nums text-[var(--status-success-foreground)]">
                  {carryGain === 0 ? "Current" : `${carryGain >= 0 ? "+" : ""}${carryGain} yd`}
                </p>
              </div>
              <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary"
                  style={{ width: `${currentCarryPercent}%` }}
                />
                {carryDeltaWidth > 0 ? (
                  <div
                    className={cn(
                      "absolute inset-y-0",
                      carryGain >= 0
                        ? "bg-[var(--status-success-foreground)]"
                        : "bg-[var(--status-warning-foreground)]",
                    )}
                    style={{
                      left: `${carryDeltaLeft}%`,
                      width: `${Math.min(100 - carryDeltaLeft, Math.max(1, carryDeltaWidth))}%`,
                    }}
                  />
                ) : null}
                <div
                  className="absolute inset-y-[-2px] w-0.5 rounded-full bg-foreground shadow-sm shadow-background/80"
                  style={{ left: `calc(${projectedCarryPercent}% - 1px)` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildSelectedSpeedModel(
  row: FutureBagProjectionRow,
  targetSpeedMph: number | null,
): SelectedSpeedModel | null {
  if (row.currentClubSpeedMph === null) {
    return null;
  }

  const baselineSpeed = row.currentClubSpeedMph;
  const tourSpeed = getTourSpeedBenchmark(row.clubType) ?? baselineSpeed + 5;
  const driverTarget = row.clubType === "driver" && targetSpeedMph !== null ? targetSpeedMph : null;
  const targetSpeed =
    driverTarget !== null
      ? Math.max(baselineSpeed, Math.min(driverTarget, tourSpeed))
      : Math.min(tourSpeed, baselineSpeed + defaultClubSpeedGain(row.clubType));
  const defaultSpeed = roundSliderSpeed(Math.max(baselineSpeed, targetSpeed));

  return {
    baselineSpeed,
    defaultSpeed,
    minSpeed: roundSliderSpeed(baselineSpeed),
    maxSpeed: roundSliderSpeed(Math.max(tourSpeed, baselineSpeed)),
  };
}

function projectedCarry(currentCarryYd: number, carryGainPerMph: number, speedDelta: number) {
  return Math.max(0, Math.round(currentCarryYd + carryGainPerMph * speedDelta));
}

function carryScalePercent(carryYd: number, maxCarryYd: number) {
  return Math.max(0, Math.min(100, (carryYd / Math.max(1, maxCarryYd)) * 100));
}

function shortClubLabel(row: FutureBagProjectionRow) {
  return row.clubLabel.split(" - ")[0] ?? row.clubLabel;
}

function speedLevelLabel(benchmark: ClubSpeedBenchmarkTarget) {
  return `${benchmark.currentLevelLabel} speed`;
}

function speedLevelDetail(benchmark: ClubSpeedBenchmarkTarget) {
  if (benchmark.gapMph === null) {
    return "Benchmark pending";
  }

  if (benchmark.currentLevelKey === "tour-plus") {
    return "Above Tour benchmark, not a recommended target";
  }

  if (benchmark.gapMph <= 0) {
    return benchmark.currentLevelKey === "tour"
      ? "Tour benchmark, not a recommended target"
      : `${benchmark.currentLevelLabel} benchmark`;
  }

  return `${formatMphGap(benchmark.gapMph)} to ${benchmark.targetLevelLabel}`;
}

function speedBenchmarkBadgeClass(levelKey: ClubSpeedBenchmarkTarget["currentLevelKey"]) {
  switch (levelKey) {
    case "tour":
    case "tour-plus":
      return "border-primary/30 bg-primary/10 text-primary";
    case "advanced":
    case "good":
      return "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]";
    case "average":
      return "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]";
    case "beginner":
    case "building":
      return "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function formatMphGap(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toFixed(1)} mph`;
}

function getTourSpeedBenchmark(clubType: string) {
  const levels = getClubBenchmarkMetricLevels(clubType, "clubSpeedMph", 1);
  return levels?.find((level) => level.key === "tour")?.value ?? null;
}

function roundSliderSpeed(value: number) {
  return Math.round(value * 10) / 10;
}

function clampSliderSpeed(value: number, model: SelectedSpeedModel) {
  return roundSliderSpeed(Math.min(model.maxSpeed, Math.max(model.minSpeed, value)));
}

function formatSliderSpeed(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function defaultClubSpeedGain(clubType: string) {
  if (clubType === "driver") {
    return 5;
  }

  if (/^[2-7][wh]$/.test(clubType)) {
    return 4;
  }

  if (/^[3-9]i$/.test(clubType)) {
    return 3;
  }

  return 2;
}
