"use client";

import { useMemo, useState } from "react";

import {
  FacePathDeliveryChart,
  formatSignedDegrees,
  type FacePathDeliveryDatum,
} from "@/components/visuals/face-path-delivery-chart";
import type { PathTrendTracking } from "@/lib/bag-intelligence";
import { cn } from "@/lib/utils";

type DeliveryClubOption = FacePathDeliveryDatum & {
  clubId: string;
  clubType: string;
  sampleSize: number;
  patternCode: string;
  isPriorityClub: boolean;
};

const DRIVER_PATH_TARGET = { label: "Path target", min: 2, max: 5 };
const DRIVER_FACE_TARGET = { label: "Face target", min: 3, max: 5 };

export function FacePathClubSelector({
  pathTrend,
  className,
}: {
  pathTrend: PathTrendTracking;
  className?: string;
}) {
  const clubs = useMemo(() => buildDeliveryClubOptions(pathTrend), [pathTrend]);
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.clubId ?? "");
  const selected = clubs.find((club) => club.clubId === selectedClubId) ?? clubs[0] ?? null;
  const targetWindow =
    selected?.clubType.toLowerCase() === "driver"
      ? { path: DRIVER_PATH_TARGET, face: DRIVER_FACE_TARGET }
      : undefined;

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
        "relative overflow-hidden rounded-[18px] bg-[#F7FBF8] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(213,229,218,0.82)]",
        className,
      )}
    >
      <div className="grid gap-3 2xl:grid-cols-[minmax(220px,0.72fr)_minmax(360px,1.28fr)] 2xl:items-center">
        <div className="grid gap-2">
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
              <p className="text-[22px] font-bold leading-7 tracking-normal text-[#111827]">
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
            <MetricPill label="F-P" value={formatSignedDegrees(selected.faceToPathDeg)} tone="green" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-[#667085] 2xl:block 2xl:space-y-1">
            <span className="font-medium text-[#111827]">
              {selected.faceToPathDeg === null
                ? "Face-to-path needs face angle or launch-direction rows."
                : `${selected.label} face is ${formatSignedDegrees(selected.faceToPathDeg)} relative to path.`}
            </span>
            <span className="block">{selected.patternCode} pattern classification</span>
          </div>
        </div>

        <FacePathDeliveryChart
          datum={selected}
          idPrefix={`dashboard-${selected.clubId}`}
          chartClassName="bg-white"
          targetWindow={targetWindow}
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
