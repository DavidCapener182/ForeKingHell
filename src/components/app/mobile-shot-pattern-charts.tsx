"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  defaultShotPatternClub,
  filterShotPatternPoints,
  shotPatternClubs,
  shotPatternConfidence,
  summarizeShotPattern,
  type ShotPatternPoint,
} from "@/lib/shot-pattern-chart-data";
import { cn } from "@/lib/utils";

type ChartMode = "dispersion" | "flight";
type FlightMode = "shots" | "average";

const SharedShotPatternVisual = dynamic(
  () => import("@/app/today/today-shot-charts").then((module) => module.SharedShotPatternVisual),
  {
    loading: () => (
      <Skeleton
        className="aspect-[82/43] w-full rounded-xl"
        aria-label="Drawing measured shot pattern"
      />
    ),
  },
);

export function MobileShotPatternCharts({
  points,
  preferredClub,
  compact = false,
}: {
  points: ShotPatternPoint[];
  preferredClub?: string | null;
  compact?: boolean;
}) {
  const clubs = useMemo(() => shotPatternClubs(points), [points]);
  const [mode, setMode] = useState<ChartMode>("dispersion");
  const [flightMode, setFlightMode] = useState<FlightMode>("shots");
  const [club, setClub] = useState(() => defaultShotPatternClub(clubs, preferredClub));
  const [trustedOnly, setTrustedOnly] = useState(true);
  const [selectedShot, setSelectedShot] = useState<ShotPatternPoint | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const selected = useMemo(
    () => filterShotPatternPoints({ points, club, trustedOnly }),
    [club, points, trustedOnly],
  );
  const hasFlight = selected.some((point) => point.carryYd !== null && point.apexFt !== null);
  const summary = useMemo(() => summarizeShotPattern(selected), [selected]);
  const confidence = useMemo(() => shotPatternConfidence(selected), [selected]);

  if (clubs.length === 0) {
    return (
      <AppEmptyState
        title="No measured landing data"
        description="Import a measured session with carry and lateral coordinates to unlock the shot pattern."
        primaryAction={
          <Button asChild size="sm">
            <Link href="/import">Import a session</Link>
          </Button>
        }
      />
    );
  }

  return (
    <section
      className="grid min-w-0 gap-3 overflow-hidden"
      data-mobile-shot-pattern
      data-mobile-shot-pattern-hydrated={hydrated ? "true" : "false"}
    >
      {!compact ? (
        <Tabs value={mode} onValueChange={(value) => setMode(value as ChartMode)}>
          <TabsList className="grid w-full grid-cols-2" aria-label="Shot pattern view">
            <TabsTrigger value="dispersion">Dispersion</TabsTrigger>
            <TabsTrigger value="flight" disabled={!hasFlight}>
              Flight
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}
      {!compact && !hasFlight ? (
        <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          Flight is unavailable because this session has no measured apex data.
        </p>
      ) : null}

      {!compact && mode === "flight" && hasFlight ? (
        <ToggleGroup
          type="single"
          value={flightMode}
          onValueChange={(value) => value && setFlightMode(value as FlightMode)}
          variant="outline"
          className="grid w-full grid-cols-2"
          aria-label="Flight detail"
        >
          <ToggleGroupItem value="shots" className="w-full">
            Individual shots
          </ToggleGroupItem>
          <ToggleGroupItem value="average" className="w-full">
            Club average
          </ToggleGroupItem>
        </ToggleGroup>
      ) : null}

      <ToggleGroup
        type="single"
        value={club}
        onValueChange={(value) => value && setClub(value)}
        className="-mx-1 w-auto snap-x justify-start gap-2 overflow-x-auto px-1 pb-1"
        aria-label="Chart club"
      >
        {clubs.map((item) => (
          <ToggleGroupItem
            key={item.type}
            value={item.type}
            variant="outline"
            size="lg"
            className="focus-aaa min-h-11 shrink-0 snap-start rounded-full px-3 text-sm font-semibold"
          >
            {item.label}
          </ToggleGroupItem>
        ))}
        {clubs.length > 1 && !compact ? (
          <ToggleGroupItem
            value="all"
            variant="outline"
            size="lg"
            className="focus-aaa min-h-11 shrink-0 snap-start rounded-full px-3 text-sm font-semibold"
          >
            All clubs
          </ToggleGroupItem>
        ) : null}
      </ToggleGroup>

      {!compact ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {confidence.sampleSize} measured landing points · {confidence.label} confidence
          </p>
          <ToggleGroup
            type="single"
            value={trustedOnly ? "trusted" : "all"}
            onValueChange={(value) => value && setTrustedOnly(value === "trusted")}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Evidence trust"
          >
            <ToggleGroupItem value="trusted">Trusted shots</ToggleGroupItem>
            <ToggleGroupItem value="all">All shots</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ) : null}

      {mode === "dispersion" || compact ? (
        <div className={cn("overflow-hidden rounded-xl bg-background", compact && "max-h-52")}>
          <SharedShotPatternVisual shots={selected} mode="dispersion" />
        </div>
      ) : hasFlight ? (
        <div className="overflow-hidden rounded-xl bg-background">
          <SharedShotPatternVisual
            shots={selected}
            mode="trajectory"
            trajectoryView={flightMode === "average" ? "averages" : "shots"}
          />
        </div>
      ) : (
        <p className="rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">
          Flight is unavailable because this session has no measured apex data.
        </p>
      )}

      <p className="text-sm font-medium leading-5" aria-live="polite">
        {patternReadout(summary)}
      </p>

      {!compact ? <AccessibleShotTable points={selected} onSelect={setSelectedShot} /> : null}

      <ShotDetailDrawer
        shot={selectedShot}
        onOpenChange={(open) => !open && setSelectedShot(null)}
      />
    </section>
  );
}

function AccessibleShotTable({
  points,
  onSelect,
}: {
  points: ShotPatternPoint[];
  onSelect: (point: ShotPatternPoint) => void;
}) {
  return (
    <Collapsible className="rounded-xl border bg-card px-3 py-2">
      <CollapsibleTrigger className="focus-aaa min-h-11 w-full cursor-pointer py-3 text-left text-sm font-semibold outline-none">
        Accessible shot data ({points.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-72 overflow-auto pb-2">
          <Table className="min-w-[34rem] text-xs">
            <caption className="sr-only">Measured shot data used by this chart</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Shot</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Carry</TableHead>
                <TableHead>Lateral</TableHead>
                <TableHead>Apex</TableHead>
                <TableHead>Trust</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point, index) => (
                <TableRow key={point.id}>
                  <TableCell>{point.shotNumber ?? index + 1}</TableCell>
                  <TableCell>{point.clubLabel}</TableCell>
                  <TableCell>{formatMeasure(point.carryYd, "yd")}</TableCell>
                  <TableCell>{formatSigned(point.sideCarryYd)}</TableCell>
                  <TableCell>{formatMeasure(point.apexFt, "ft")}</TableCell>
                  <TableCell>{point.trusted ? "Trusted" : "Unusual"}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(point)}>
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ShotDetailDrawer({
  shot,
  onOpenChange,
}: {
  shot: ShotPatternPoint | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={Boolean(shot)} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="pb-[env(safe-area-inset-bottom)]" data-shot-detail-drawer>
        <DrawerHeader className="text-left">
          <div className="flex items-start justify-between gap-3">
            <span>
              <DrawerTitle>
                {shot ? `${shot.clubLabel} · shot ${shot.shotNumber ?? "detail"}` : "Shot detail"}
              </DrawerTitle>
              <DrawerDescription>Measured values used by this session chart.</DrawerDescription>
            </span>
            {shot ? (
              <Badge variant={shot.trusted ? "secondary" : "outline"}>
                {shot.trusted ? "Trusted" : "Unusual"}
              </Badge>
            ) : null}
          </div>
        </DrawerHeader>
        {shot ? (
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            <ShotMetric label="Carry" value={formatMeasure(shot.carryYd, "yd")} />
            <ShotMetric label="Total" value={formatMeasure(shot.totalYd ?? null, "yd")} />
            <ShotMetric label="Lateral" value={formatSigned(shot.sideCarryYd)} />
            <ShotMetric label="Apex" value={formatMeasure(shot.apexFt, "ft")} />
            <ShotMetric label="Launch" value={formatMeasure(shot.launchAngleDeg, "°")} />
            <ShotMetric
              label="Ball speed"
              value={formatMeasure(shot.ballSpeedMph ?? null, "mph")}
            />
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function ShotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-semibold text-foreground">{value}</p>
    </div>
  );
}

function patternReadout(summary: ReturnType<typeof summarizeShotPattern>) {
  if (summary.sampleSize === 0 || summary.medianSideYd === null) {
    return "No measured carry and lateral coordinates are available for this selection.";
  }
  const direction =
    Math.abs(summary.medianSideYd) < 1
      ? "on the centre line"
      : `${Math.abs(Math.round(summary.medianSideYd))} yd ${summary.medianSideYd < 0 ? "left" : "right"}`;
  const miss = summary.typicalMiss
    ? typicalMissReadout(summary)
    : summary.widerSide
      ? ` Wider side: ${summary.widerSide.toLowerCase()}.`
      : "";
  return `${summary.insideCorridor} of ${summary.sampleSize} shots finished inside the playable corridor. The pattern centres ${direction}.${miss}`;
}

function typicalMissReadout(summary: ReturnType<typeof summarizeShotPattern>) {
  const typical = summary.typicalMiss?.toLowerCase();
  if (!typical) return "";
  const extent =
    summary.typicalMiss === "Left"
      ? summary.sideLowYd === null
        ? null
        : Math.abs(summary.sideLowYd)
      : summary.typicalMiss === "Right"
        ? summary.sideHighYd === null
          ? null
          : Math.abs(summary.sideHighYd)
        : null;
  return extent === null
    ? ` Typical pattern: ${typical}.`
    : ` Typical pattern: ${typical}; the ${typical}-side miss reaches ${Math.round(extent)} yd.`;
}

function formatMeasure(value: number | null, unit: string) {
  return value === null ? "Unavailable" : `${Math.round(value)} ${unit}`;
}

function formatSigned(value: number | null) {
  if (value === null) return "Unavailable";
  if (Math.abs(value) < 0.5) return "Centre";
  return `${Math.abs(Math.round(value))} yd ${value < 0 ? "left" : "right"}`;
}
