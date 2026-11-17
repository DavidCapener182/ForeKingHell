"use client";

import { type ReactNode, useMemo, useState } from "react";

import {
  FacePathDeliveryChart,
  formatSignedDegrees,
  type FacePathDeliveryDatum,
} from "@/components/visuals/face-path-delivery-chart";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UntitledSelect, UntitledTextField } from "@/components/untitled-ui/form-controls";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const targetWindow = selected ? benchmarkDeliveryTargetWindow(selected.clubType) : null;

  if (!selected) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/35 px-4 py-4 text-sm text-muted-foreground",
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
        "relative overflow-hidden rounded-lg border border-border bg-card px-3 shadow-sm",
        compact ? "py-2.5" : "py-3",
        className,
      )}
    >
      <div
        className={cn(
          "grid items-start xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]",
          compact ? "gap-2" : "gap-3",
        )}
      >
        <div className="grid content-start gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-normal text-primary">
                Club delivery
              </p>
              <Badge variant="secondary">
                {selected.isPriorityClub ? "Priority read" : "Club read"}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p
                className={cn(
                  "font-bold tracking-normal text-foreground",
                  compact ? "text-[20px] leading-6" : "text-[22px] leading-7",
                )}
              >
                {selected.patternLabel}
              </p>
              <p className="text-sm leading-5 text-muted-foreground">
                {selected.label} · {selected.sampleSize} measured shots
              </p>
            </div>
          </div>

          <div className="hidden lg:block">
            <UntitledSelect
              label="Selected club"
              name="deliveryClub"
              value={selected.clubId}
              onValueChange={setSelectedClubId}
              options={clubs.map((club) => ({
                value: club.clubId,
                label: `${club.label} · ${club.sampleSize} shots`,
              }))}
            />
          </div>
          <div className="lg:hidden">
            <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="min-h-11 w-full justify-between">
                  {selected.label}
                  <span>Change club</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="max-h-[85dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
                showCloseButton={false}
              >
                <SheetHeader>
                  <SheetTitle>Choose a club</SheetTitle>
                  <SheetDescription>
                    Update the chart, measurements and diagnosis together.
                  </SheetDescription>
                </SheetHeader>
                <div className="grid gap-2 px-4">
                  <UntitledTextField
                    label="Search clubs"
                    name="deliverySearch"
                    type="search"
                    value={search}
                    onValueChange={setSearch}
                  />
                  {clubs
                    .filter((club) => club.label.toLowerCase().includes(search.toLowerCase()))
                    .map((club) => (
                      <Button
                        key={club.clubId}
                        variant={club.clubId === selected.clubId ? "default" : "outline"}
                        aria-pressed={club.clubId === selected.clubId}
                        className="h-auto min-h-11 justify-between whitespace-normal text-left"
                        onClick={() => {
                          setSelectedClubId(club.clubId);
                          setPickerOpen(false);
                        }}
                      >
                        <span>{club.label}</span>
                        <span>{club.sampleSize} shots</span>
                      </Button>
                    ))}
                  {!clubs.some((club) =>
                    club.label.toLowerCase().includes(search.toLowerCase()),
                  ) ? (
                    <p role="status" className="py-4 text-sm">
                      No matching clubs. Clear the search to see every club.
                    </p>
                  ) : null}
                  <SheetClose asChild>
                    <Button variant="outline" className="min-h-11">
                      Close
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <DeliveryAngles club={selected} />
          {action ? <div className="pt-1 2xl:mt-auto">{action}</div> : null}
        </div>

        <FacePathDeliveryChart
          datum={selected}
          idPrefix={`dashboard-${selected.clubId}`}
          compact={compact}
          chartClassName="bg-background"
          showAccessibleFallback
          showMetricPills={false}
          targetWindow={targetWindow ?? undefined}
        />
      </div>
    </div>
  );
}

function DeliveryAngles({ club }: { club: DeliveryClubOption }) {
  const readings = [
    { label: "Club path", value: club.pathDeg, reference: "against the target line" },
    { label: "Club face", value: club.faceDeg, reference: "against the target line" },
    { label: "Face to path", value: club.faceToPathDeg, reference: "relative to the swing path" },
  ];
  const extent = Math.max(5, ...readings.map(({ value }) => Math.ceil(Math.abs(value ?? 0))));
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="p-4">
        <dl className="divide-y">
          {readings.map(({ label, value, reference }) => (
            <div
              key={label}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(4rem,1fr)_4rem] items-center gap-3 py-3"
            >
              <dt className="min-w-0">
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs leading-5 text-muted-foreground">{reference}</span>
              </dt>
              <dd className="relative h-2 rounded-sm bg-muted" aria-hidden="true">
                <span className="absolute inset-y-[-3px] left-1/2 w-px bg-foreground/60" />
                {value !== null && (
                  <span
                    className="absolute inset-y-0 rounded-sm bg-primary"
                    style={{
                      left: `${50 + (Math.min(0, value) / extent) * 50}%`,
                      width: `${(Math.abs(value) / extent) * 50}%`,
                    }}
                  />
                )}
              </dd>
              <dd className="text-right text-lg font-semibold tabular-nums">
                {value === null ? "—" : formatSignedDegrees(value).replace(" deg", "°")}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Centre line is 0°. Each scale runs from −{extent}° to +{extent}°. Face readings may be
          estimated from launch direction.
        </p>
      </CardContent>
    </Card>
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
