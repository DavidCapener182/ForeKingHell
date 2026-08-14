"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { CompactReadoutGrid, DataTableFrame } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ShotMapDistanceGuides } from "@/components/visuals/shot-map-distance-guides";
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
  SelectedShotDetail,
  type ShotMasterDetailRow,
} from "@/app/shots/shots-master-detail-table";
import { clubSortValue, formatClubType } from "@/lib/club-format";
import {
  SHOT_MAP_MAX_CARRY_YD,
  SHOT_MAP_MAX_SIDE_YD,
  shotMapPointForYards,
} from "@/lib/shot-map-scale";
import { buildShotShapeTrace, type ShotShapeTrace } from "@/lib/shot-shape-trace";

export type InteractiveShotShapeMapRow = ShotMasterDetailRow & {
  shotAt: string;
  carryYd: number | null;
  sideCarryYd: number | null;
  launchDirectionDeg: number | null;
  spinAxis: number | null;
};

type RenderedShotShapeTrace = ShotShapeTrace & {
  sideCarryYd: number | null;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function InteractiveDesktopShotMapContent({
  shots,
  initialClub = "",
}: {
  shots: InteractiveShotShapeMapRow[];
  initialClub?: string;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [selectedClub, setSelectedClub] = useState(initialClub);
  const clubTypes = useMemo(
    () =>
      [...new Set(shots.map((shot) => shot.clubType))].sort(
        (left, right) => clubSortValue(left) - clubSortValue(right),
      ),
    [shots],
  );
  const visibleShots = useMemo(
    () => (selectedClub ? shots.filter((shot) => shot.clubType === selectedClub) : shots),
    [selectedClub, shots],
  );
  const model = useMemo(() => buildShotShapeMapModel(visibleShots), [visibleShots]);
  const selectedShot = model.plottedShots.find((shot) => shot.id === selectedId) ?? null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/35 p-2">
        <span className="px-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Club
        </span>
        <ToggleGroup
          type="single"
          value={selectedClub || "all"}
          onValueChange={(value) => {
            if (!value) return;
            setSelectedClub(value === "all" ? "" : value);
            setSelectedId("");
          }}
          aria-label="Filter top-down map by club"
          className="h-auto flex-wrap justify-start bg-transparent p-0"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          {clubTypes.map((clubType) => (
            <ToggleGroupItem key={clubType} value={clubType}>
              {clubType === "driver" ? "D" : formatClubType(clubType)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="overflow-hidden rounded-lg border border-emerald-950/10 bg-[#eef6ef]">
          <div
            data-media-container
            aria-label="Interactive top-down shot shape map"
            className="relative aspect-[16/9] min-h-[28rem] overflow-hidden rounded-lg bg-[#eef6ef]"
          >
            <Image
              src="/assets/fairway-dispersion-bg.svg"
              alt=""
              fill
              loading="eager"
              sizes="(min-width: 1280px) 58vw, 100vw"
              className="object-cover opacity-95"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(5,44,23,0.08))]" />
            {model.shapeTraces.length > 0 ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
              >
                <path
                  d="M 50 88 L 50 16"
                  fill="none"
                  stroke="rgba(15,23,42,0.18)"
                  strokeDasharray="2 3"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
                <ShotMapDistanceGuides />
                {model.shapeTraces.map((trace) => (
                  <path
                    key={trace.id}
                    d={trace.path}
                    fill="none"
                    stroke={traceStroke(trace.sideCarryYd, trace.source)}
                    strokeLinecap="round"
                    strokeWidth={trace.source === "straight" ? "1.7" : "2.35"}
                    vectorEffect="non-scaling-stroke"
                    opacity={trace.source === "straight" ? 0.42 : 0.72}
                  />
                ))}
                <circle
                  cx="50"
                  cy="88"
                  r="1.3"
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth="1.4"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ) : null}
            {model.plottedShots.length > 0 ? (
              model.plottedShots.slice(0, 80).map((shot) => {
                const { x, y } = shotMapPointForYards({
                  carryYd: Number(shot.carryYd),
                  sideCarryYd: Number(shot.sideCarryYd),
                });
                const selected = shot.id === selectedShot?.id;

                return (
                  <button
                    key={shot.id}
                    type="button"
                    data-shot-map-point={shot.id}
                    aria-label={`Show ${shot.clubTypeLabel} shot ${shot.shotNumberLabel} from ${formatDate(shot.shotAt)}`}
                    aria-pressed={selected}
                    onClick={() => setSelectedId(shot.id)}
                    className="focus-aaa absolute z-[2] -translate-x-1/2 -translate-y-1/2 rounded-full p-2 outline-none"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <span
                      className={`block size-3 rounded-full border border-white shadow-[0_0_0_4px_rgba(255,255,255,0.5)] ${dispersionPointClass(
                        shot.sideCarryYd,
                      )} ${selected ? "ring-2 ring-amber-300 ring-offset-2" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })
            ) : (
              <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-lg bg-card/90 p-4 text-center text-sm font-medium text-muted-foreground shadow-sm">
                No carry and side data match this filter yet.
              </div>
            )}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <CompactReadoutGrid
            columnsClassName="sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3"
            items={[
              {
                label: "Carry",
                value: formatYards(model.averageCarry),
                detail: "Average plotted carry",
                tone: "green",
              },
              {
                label: "Playable",
                value: `${model.playableCount}/${model.plottedShots.length || 0}`,
                detail: "Inside 20 yd offline",
                tone: "sky",
              },
              {
                label: "Shape",
                value: `${model.telemetryTraceCount}/${model.shapeTraces.length}`,
                detail: "Launch-derived curves",
                tone: "amber",
              },
            ]}
          />
          {selectedShot ? (
            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setSelectedId("")}
              >
                Show latest mapped shots
              </Button>
              <SelectedShotDetail shot={selectedShot} compact />
            </div>
          ) : (
            <LatestMappedShotsTable shots={model.plottedShots.slice(0, 6)} />
          )}
          <p className="text-sm leading-6 text-muted-foreground">
            This is an inferred top-down path, not measured ball-flight tracking. Landing position
            uses carry and side; curved shape requires launch direction.
          </p>
        </div>
      </div>
    </div>
  );
}

function LatestMappedShotsTable({ shots }: { shots: InteractiveShotShapeMapRow[] }) {
  return (
    <DataTableFrame label="Latest inferred shot shape rows" stickyFirstColumn>
      <Table
        data-workbench-scope="shots-shape-evidence"
        aria-describedby="shots-shape-evidence-summary"
      >
        <TableCaption id="shots-shape-evidence-summary" className="sr-only">
          Latest inferred shot-shape evidence table showing shot, side distance and launch telemetry
          used for the desktop shot-shape map.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead data-column="shot">Shot</TableHead>
            <TableHead data-column="side">Side</TableHead>
            <TableHead data-column="shape">Shape evidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shots.map((shot) => (
            <TableRow
              key={`desktop-shape-${shot.id}`}
              tabIndex={0}
              className="focus-aaa outline-none"
            >
              <TableCell data-column="shot" className="font-medium">
                <span className="block">{shot.clubTypeLabel}</span>
                <span className="text-xs text-muted-foreground">
                  {formatYards(shot.carryYd)} · {formatDate(shot.shotAt)}
                </span>
              </TableCell>
              <TableCell data-column="side">{formatSignedYards(shot.sideCarryYd)}</TableCell>
              <TableCell data-column="shape">
                {formatShapeTelemetry(shot.launchDirectionDeg, shot.spinAxis)}
              </TableCell>
            </TableRow>
          ))}
          {shots.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                No carry and side data match this filter yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </DataTableFrame>
  );
}

function buildShotShapeMapModel(shots: InteractiveShotShapeMapRow[]) {
  const plottedShots = shots.filter(
    (shot) => isFiniteShotMetric(shot.carryYd) && isFiniteShotMetric(shot.sideCarryYd),
  );
  const maxCarry = SHOT_MAP_MAX_CARRY_YD;
  const maxSide = SHOT_MAP_MAX_SIDE_YD;
  const shapeTraces = plottedShots
    .slice(0, 64)
    .map((shot) =>
      buildShotShapeTrace({
        id: shot.id,
        carryYd: shot.carryYd,
        sideCarryYd: shot.sideCarryYd,
        launchDirectionDeg: shot.launchDirectionDeg,
        spinAxis: shot.spinAxis,
        maxCarryYd: maxCarry,
        maxSideYd: maxSide,
      }),
    )
    .map((trace, index) =>
      trace
        ? {
            ...trace,
            sideCarryYd: plottedShots[index]?.sideCarryYd ?? null,
          }
        : null,
    )
    .filter((trace): trace is RenderedShotShapeTrace => trace !== null);

  return {
    plottedShots,
    shapeTraces,
    telemetryTraceCount: shapeTraces.filter((trace) => trace.source === "estimated").length,
    playableCount: plottedShots.filter((shot) => Math.abs(Number(shot.sideCarryYd)) <= 20).length,
    averageCarry: averageShotMetric(plottedShots.map((shot) => shot.carryYd)),
    maxCarry,
    maxSide,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatSignedYards(value: number | null) {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)} yd`;
}

function formatShapeTelemetry(launchDirectionDeg: number | null, spinAxis: number | null) {
  if (launchDirectionDeg !== null) return `${numberFormatter.format(launchDirectionDeg)} deg start`;
  if (spinAxis !== null) return `${numberFormatter.format(spinAxis)} deg axis`;
  return "Landing line";
}

function averageShotMetric(values: Array<number | null>) {
  const finite = values.filter(isFiniteShotMetric);
  if (finite.length === 0) return null;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function isFiniteShotMetric(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function traceStroke(sideCarryYd: number | null, source: "estimated" | "straight") {
  if (source === "straight") return "rgba(15, 118, 110, 0.58)";
  if (sideCarryYd === null) return "rgba(15, 118, 110, 0.62)";
  if (sideCarryYd < -12) return "rgba(190, 24, 93, 0.72)";
  if (sideCarryYd > 12) return "rgba(234, 88, 12, 0.72)";
  return "rgba(5, 150, 105, 0.72)";
}

function dispersionPointClass(sideCarryYd: number | null) {
  if (sideCarryYd === null) return "bg-slate-500";
  if (sideCarryYd < -12) return "bg-pink-500";
  if (sideCarryYd > 12) return "bg-amber-500";
  return "bg-emerald-500";
}
