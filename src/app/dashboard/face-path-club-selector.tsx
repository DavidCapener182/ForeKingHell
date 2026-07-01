"use client";

import { type ReactNode, useMemo, useState } from "react";

import {
  FacePathDeliveryChart,
  formatSignedDegrees,
  type FacePathDeliveryDatum,
} from "@/components/visuals/face-path-delivery-chart";
import type { PathTrendTracking } from "@/lib/bag-intelligence";
import { getClubDistanceBenchmark, type ClubBenchmarkLevelKey } from "@/lib/club-benchmarks";
import { cn } from "@/lib/utils";

type DeliveryClubOption = FacePathDeliveryDatum & {
  clubId: string;
  clubType: string;
  sampleSize: number;
  patternCode: string;
  isPriorityClub: boolean;
};

export function FacePathClubSelector({
  pathTrend,
  action,
  className,
  compact = false,
}: {
  pathTrend: PathTrendTracking;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const clubs = useMemo(() => buildDeliveryClubOptions(pathTrend), [pathTrend]);
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.clubId ?? "");
  const selected = clubs.find((club) => club.clubId === selectedClubId) ?? clubs[0] ?? null;
  const targetWindow = selected ? benchmarkDeliveryTargetWindow(selected.clubType) : null;

  if (!selected) {
    return (
      <div
        className={cn(
          "rounded-[18px] bg-[#F7FBF8] px-4 py-4 text-sm text-[#667085] shadow-[inset_0_0_0_1px_rgba(213,229,218,0.82)]",
          className,
        )}
      >
        Import club-path rows to build face-to-path reads.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[18px] bg-[#F7FBF8] px-3 shadow-[inset_0_0_0_1px_rgba(213,229,218,0.82)]",
        compact ? "py-2.5" : "py-3",
        className,
      )}
    >
      <div
        className={cn(
          "grid 2xl:grid-cols-[minmax(220px,0.72fr)_minmax(360px,1.28fr)] 2xl:items-stretch",
          compact ? "gap-2" : "gap-3",
        )}
      >
        <div className="grid h-full gap-2">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-normal text-[#087A3D]">
                Club delivery
              </p>
              <span className="inline-flex min-h-6 items-center rounded-full bg-[#E8F7EE] px-2.5 text-xs font-medium text-[#087A3D] ring-1 ring-[#CFE7D6]">
                {selected.isPriorityClub ? "Priority read" : "Club read"}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p
                className={cn(
                  "font-bold tracking-normal text-[#111827]",
                  compact ? "text-[20px] leading-6" : "text-[22px] leading-7",
                )}
              >
                {selected.patternLabel}
              </p>
              <p className="text-sm leading-5 text-[#667085]">
                {selected.label} · {selected.sampleSize} measured shots
              </p>
            </div>
          </div>

          {clubs.length > 1 ? (
            <div className="-mx-0.5 flex gap-1.5 overflow-x-auto pb-1">
              {clubs.map((club) => {
                const isSelected = club.clubId === selected.clubId;

                return (
                  <button
                    key={club.clubId}
                    type="button"
                    onClick={() => setSelectedClubId(club.clubId)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold leading-4 transition-colors",
                      isSelected
                        ? "bg-[#087A3D] text-white shadow-sm"
                        : "bg-white text-[#526071] ring-1 ring-[#DFE7DF] hover:text-[#111827]",
                    )}
                    aria-pressed={isSelected}
                  >
                    {club.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-1.5 text-xs font-bold leading-4">
            <MetricPill label="Path" value={formatSignedDegrees(selected.pathDeg)} />
            <MetricPill label="Face" value={formatSignedDegrees(selected.faceDeg)} />
            <MetricPill
              label="F-P"
              value={formatSignedDegrees(selected.faceToPathDeg)}
              tone="green"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-[#667085] 2xl:block 2xl:space-y-1">
            <span className="font-medium text-[#111827]">
              {selected.faceToPathDeg === null
                ? "Face-to-path needs face angle or launch-direction rows."
                : `${selected.label} face is ${formatSignedDegrees(selected.faceToPathDeg)} relative to path.`}
            </span>
            <span className="block">{selected.patternCode} pattern classification</span>
          </div>

          {action ? <div className="pt-1 2xl:mt-auto">{action}</div> : null}
        </div>

        <FacePathDeliveryChart
          datum={selected}
          idPrefix={`dashboard-${selected.clubId}`}
          compact={compact}
          chartClassName="bg-white"
          showMetricPills={!compact}
          targetWindow={targetWindow ?? undefined}
        />
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green";
}) {
  return (
    <span
      className={cn(
        "rounded-full bg-white px-2.5 py-1.5 text-[#111827]",
        tone === "green" ? "text-[#087A3D]" : null,
      )}
    >
      {label} {value}
    </span>
  );
}

function buildDeliveryClubOptions(pathTrend: PathTrendTracking): DeliveryClubOption[] {
  const latestPoint =
    [...pathTrend.points].reverse().find((point) => point.pathDeg !== null) ?? null;
  const latestShot = pathTrend.recentShots[0] ?? null;
  const priorityClubId = pathTrend.clubId;
  const summaries = pathTrend.clubs;

  return summaries
    .map((club) => {
      const isPriorityClub = Boolean(priorityClubId && club.clubId === priorityClubId);
      const pathDeg = isPriorityClub
        ? (latestPoint?.pathDeg ?? latestShot?.pathDeg ?? club.pathDeg)
        : club.pathDeg;
      const faceDeg = isPriorityClub
        ? (latestPoint?.faceDeg ?? latestShot?.faceDeg ?? club.faceDeg)
        : club.faceDeg;
      const faceToPathDeg = isPriorityClub
        ? (latestPoint?.faceToPathProxyDeg ??
          latestShot?.faceToPathProxyDeg ??
          club.faceToPathProxyDeg)
        : club.faceToPathProxyDeg;
      const patternLabel = isPriorityClub
        ? (latestPoint?.patternLabel ?? latestShot?.patternLabel ?? club.patternLabel)
        : club.patternLabel;
      const patternCode = isPriorityClub
        ? (latestPoint?.patternCode ?? latestShot?.patternCode ?? club.patternCode)
        : club.patternCode;
      const sampleSize = isPriorityClub
        ? (latestPoint?.sampleSize ?? pathTrend.recentShots.length ?? club.sampleSize)
        : club.sampleSize;

      return {
        clubId: club.clubId,
        clubType: club.clubType,
        label: club.label,
        patternLabel,
        patternCode,
        pathDeg,
        faceDeg,
        faceToPathDeg,
        sampleSize,
        isPriorityClub,
      };
    })
    .sort((left, right) => {
      if (left.isPriorityClub) {
        return -1;
      }

      if (right.isPriorityClub) {
        return 1;
      }

      return right.sampleSize - left.sampleSize;
    });
}

function benchmarkDeliveryTargetWindow(clubType: string) {
  const benchmark = getClubDistanceBenchmark(clubType);

  if (!benchmark) {
    return null;
  }

  const targetLevel = deliveryTargetLevel(benchmark.clubType);
  const benchmarkLevel = benchmark.levels.find((level) => level.key === targetLevel);
  const labelPrefix = benchmarkLevel?.shortLabel ?? "Good";

  if (benchmark.clubType === "driver") {
    return {
      path: { label: `${labelPrefix} path`, min: 2, max: 5 },
      face: { label: `${labelPrefix} face`, min: 3, max: 5 },
    };
  }

  const centre = deliveryWindowCentre(benchmark.clubType);
  const radius = deliveryWindowRadius(targetLevel, benchmark.clubType);

  return {
    path: {
      label: `${labelPrefix} path`,
      min: roundOne(centre.path - radius.path),
      max: roundOne(centre.path + radius.path),
    },
    face: {
      label: `${labelPrefix} face`,
      min: roundOne(centre.face - radius.face),
      max: roundOne(centre.face + radius.face),
    },
  };
}

function deliveryTargetLevel(clubType: string): ClubBenchmarkLevelKey {
  if (isScoringClub(clubType)) {
    return "advanced";
  }

  return "good";
}

function deliveryWindowCentre(clubType: string) {
  if (/^[1-9][wh]$/.test(clubType) || clubType === "hybrid") {
    return { path: 1.5, face: 1.5 };
  }

  return { path: 0, face: 0 };
}

function deliveryWindowRadius(level: ClubBenchmarkLevelKey, clubType: string) {
  const base =
    level === "tour"
      ? { path: 1, face: 1 }
      : level === "advanced"
        ? { path: 2, face: 2 }
        : level === "good"
          ? { path: 3, face: 3 }
          : level === "average"
            ? { path: 4.5, face: 4.5 }
            : { path: 6, face: 6 };

  if (/^[1-9][wh]$/.test(clubType) || clubType === "hybrid") {
    return { path: Math.max(2, base.path - 0.5), face: Math.max(2, base.face - 0.5) };
  }

  return base;
}

function isScoringClub(clubType: string) {
  if (
    clubType === "pw" ||
    clubType === "gw" ||
    clubType === "aw" ||
    clubType === "sw" ||
    clubType === "lw"
  ) {
    return true;
  }

  const iron = clubType.match(/^([1-9])i$/);
  return iron ? Number(iron[1]) >= 8 : false;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
