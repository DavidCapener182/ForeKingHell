"use client";

import { Flag, MapPinned } from "lucide-react";

import {
  ChartAccessibleFallback,
  type ChartFallbackColumn,
  type ChartFallbackRow,
} from "@/components/app/chart-accessible-fallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  CourseInferenceResult,
  InferredCourseHole,
  InferredCourseShot,
} from "@/lib/course-scorecard";
import type { HoleReviewState } from "@/app/import/import-types";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function CourseOverlay({
  inference,
  holeReview,
  totalShotCount,
  assignedShotCount,
  onReset,
  onUpdateHole,
}: {
  inference: CourseInferenceResult | null;
  holeReview: HoleReviewState;
  totalShotCount: number;
  assignedShotCount: number;
  onReset: () => void;
  onUpdateHole: (holeNumber: number, patch: HoleReviewState[number]) => void;
}) {
  if (!inference) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card p-6 text-center">
        <MapPinned className="size-8 text-primary" />
        <div className="space-y-1">
          <p className="font-medium">Waiting for a CSV and scorecard</p>
          <p className="text-sm text-muted-foreground">
            Add one simulated course CSV and scorecard rows to generate the overlay.
          </p>
        </div>
      </div>
    );
  }

  const assignedText = `${inference.assignedShotCount}/${inference.assignedShotCount + inference.unassignedShotCount}`;
  const assignmentMatches = assignedShotCount === totalShotCount;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <CourseMetric label="Mapped shots" value={assignedText} />
        <CourseMetric
          label="Review total"
          value={`${assignedShotCount}/${totalShotCount}`}
          tone={assignmentMatches ? "default" : "warning"}
        />
        <CourseMetric label="Holes" value={inference.completedHoleCount.toString()} />
        <CourseMetric
          label="Scorecard"
          value={`${inference.totalScorecardYards.toLocaleString("en-GB")} yd`}
        />
      </div>
      <div className="apple-panel flex flex-wrap items-center justify-between gap-3 p-3">
        <p className="text-sm text-muted-foreground">
          Edit CSV shots to move the boundary between holes. Enter score and penalties to calculate
          putts.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Reset auto splits
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {inference.holes.map((hole) => (
          <HoleOverlay
            key={hole.holeNumber}
            hole={hole}
            review={holeReview[hole.holeNumber]}
            onUpdate={(patch) => onUpdateHole(hole.holeNumber, patch)}
          />
        ))}
      </div>
    </div>
  );
}

function CourseMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        "apple-panel p-3",
        tone === "warning" &&
          "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)]",
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function HoleOverlay({
  hole,
  review,
  onUpdate,
}: {
  hole: InferredCourseHole;
  review: HoleReviewState[number] | undefined;
  onUpdate: (patch: HoleReviewState[number]) => void;
}) {
  const maxSide = Math.max(35, ...hole.shots.map((shot) => Math.abs(shot.displaySideYd)));
  const points = hole.shots.map((shot) => ({
    shot,
    x: 28 + Math.min(1, Math.max(0, shot.progressAfterYd / hole.yards)) * 244,
    y: 50 + Math.max(-1, Math.min(1, shot.displaySideYd / maxSide)) * 28,
  }));
  const score = review?.score ?? null;
  const explicitPutts = review?.putts ?? null;
  const penalties =
    explicitPutts !== null && score !== null
      ? Math.max(0, score - hole.shots.length - explicitPutts)
      : Math.max(0, review?.penalties ?? 0);
  const putts =
    explicitPutts ?? (score === null ? null : Math.max(0, score - hole.shots.length - penalties));

  return (
    <div className="apple-panel-strong overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b bg-muted/50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            Hole {hole.holeNumber}
            {hole.name ? ` - ${hole.name}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Par {hole.par} - {hole.yards.toLocaleString("en-GB")} yd - {hole.shots.length} shots
            {review?.strokeIndex ? ` - SI ${review.strokeIndex}` : ""}
          </p>
        </div>
        <Flag className="size-4 shrink-0 text-primary" />
      </div>
      <svg
        viewBox="0 0 300 104"
        className="h-28 w-full bg-[#f4f7f2]"
        role="img"
        aria-label={`Hole ${hole.holeNumber} overlay`}
      >
        <rect x="0" y="0" width="300" height="104" fill="#f4f7f2" />
        <path
          d="M24 50 C82 20 132 80 184 48 C220 26 252 38 276 50 C252 62 220 74 184 56 C132 24 82 84 24 50Z"
          fill="#cfe8d1"
          stroke="#a4c7a8"
        />
        <ellipse cx="266" cy="50" rx="18" ry="13" fill="#a7d8ab" stroke="#6ca771" />
        <circle cx="28" cy="50" r="5" fill="#f59e0b" />
        <line
          x1="28"
          x2="272"
          y1="50"
          y2="50"
          stroke="#6b7280"
          strokeDasharray="4 5"
          strokeOpacity="0.35"
        />
        {points.map((point, index) => {
          const previous = index === 0 ? { x: 28, y: 50 } : points[index - 1];

          return (
            <g key={`${point.shot.holeNumber}-${point.shot.holeShotNumber}`}>
              <line
                x1={previous.x}
                y1={previous.y}
                x2={point.x}
                y2={point.y}
                stroke="#111827"
                strokeWidth="1.5"
                strokeOpacity="0.45"
              />
              <circle cx={point.x} cy={point.y} r="5.5" fill={categoryColour(point.shot)} />
              <text
                x={point.x}
                y={point.y + 2.8}
                textAnchor="middle"
                fontSize="7"
                fontWeight="700"
                fill="#ffffff"
              >
                {point.shot.holeShotNumber}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartAccessibleFallback
        title={`Hole ${hole.holeNumber} overlay`}
        summary={holeOverlaySummary(hole)}
        columns={holeOverlayColumns}
        rows={holeOverlayRows(hole)}
        className="rounded-none border-x-0 border-b-0 bg-muted/30"
      />
      <div className="grid grid-cols-3 border-t px-3 py-2 text-xs">
        <span className="text-muted-foreground">Progress</span>
        <span className="text-center font-medium">{formatMetric(hole.progressYd)} yd</span>
        <span className="text-right text-muted-foreground">
          {formatMetric(hole.distanceRemainingYd)} left
        </span>
      </div>
      <div className="grid gap-2 border-t bg-muted/50 p-3 text-sm sm:grid-cols-3">
        <NumberField
          label="CSV shots"
          value={hole.shots.length}
          min={0}
          max={10}
          onChange={(value) => onUpdate({ shotCount: value })}
        />
        <NumberField
          label="Score"
          value={score}
          min={1}
          max={12}
          placeholder="-"
          onChange={(value) => onUpdate({ score: value })}
        />
        <NumberField
          label="Putts"
          value={putts}
          min={0}
          max={8}
          placeholder="-"
          onChange={(value) => onUpdate({ putts: value })}
        />
        <NumberField
          label="Penalties"
          value={penalties}
          min={0}
          max={8}
          onChange={(value) => onUpdate({ penalties: value })}
        />
        <div className="rounded-lg bg-card p-2 ring-1 ring-border">
          <p className="text-xs text-muted-foreground">Fairway</p>
          <p className="mt-1 text-lg font-semibold tracking-normal">
            {review?.fairwayHit === null || review?.fairwayHit === undefined
              ? "-"
              : review.fairwayHit
                ? "Hit"
                : "Miss"}
          </p>
        </div>
        <div className="rounded-lg bg-card p-2 ring-1 ring-border">
          <p className="text-xs text-muted-foreground">GIR</p>
          <p className="mt-1 text-lg font-semibold tracking-normal">
            {review?.gir === null || review?.gir === undefined ? "-" : review.gir ? "Hit" : "Miss"}
          </p>
        </div>
      </div>
    </div>
  );
}

const holeOverlayColumns: ChartFallbackColumn[] = [
  { key: "shot", label: "Shot" },
  { key: "category", label: "Category" },
  { key: "distance", label: "Distance" },
  { key: "progress", label: "Progress" },
  { key: "side", label: "Side" },
  { key: "remaining", label: "Remaining" },
];

function holeOverlaySummary(hole: InferredCourseHole) {
  return `Hole ${hole.holeNumber} is a par ${hole.par} playing ${hole.yards.toLocaleString(
    "en-GB",
  )} yd. ${hole.shots.length} CSV shots are assigned, progress is ${formatMetric(
    hole.progressYd,
  )} yd, and ${formatMetric(hole.distanceRemainingYd)} yd remains.`;
}

function holeOverlayRows(hole: InferredCourseHole): ChartFallbackRow[] {
  return hole.shots.map((shot) => ({
    _key: `hole-${hole.holeNumber}-shot-${shot.holeShotNumber}`,
    shot: `${shot.holeShotNumber}`,
    category: shot.shotCategory,
    distance: formatYardCell(shot.shotDistanceYd),
    progress: formatYardCell(shot.progressAfterYd),
    side: formatSignedYardCell(shot.displaySideYd),
    remaining: formatYardCell(shot.distanceRemainingYd),
  }));
}

function NumberField({
  label,
  value,
  min,
  max,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  placeholder?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="rounded-lg bg-card p-2 ring-1 ring-border">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => {
          if (event.target.value === "") {
            onChange(null);
            return;
          }

          const nextValue = Number(event.target.value);
          onChange(
            Number.isFinite(nextValue) ? Math.max(min, Math.min(max, Math.floor(nextValue))) : null,
          );
        }}
        className="mt-1 h-8 border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
      />
    </label>
  );
}

function categoryColour(shot: InferredCourseShot) {
  if (shot.shotCategory === "tee") {
    return "#111827";
  }

  if (shot.shotCategory === "approach") {
    return "#0284c7";
  }

  if (shot.shotCategory === "pitch") {
    return "#059669";
  }

  return "#f97316";
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatYardCell(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatSignedYardCell(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value === 0) {
    return "0 yd";
  }

  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)} yd`;
}
