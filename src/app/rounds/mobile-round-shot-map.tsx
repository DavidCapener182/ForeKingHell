"use client";

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { formatCompanionClubType } from "@/lib/club-format";
import {
  groupShotsByHole,
  projectHoleShots,
  roundMapViewport,
  roundMapDistanceReading,
  type RoundMapHole,
  type RoundMapShot,
  type DistanceMode,
} from "@/lib/round-map-projection";
import { LazyRoundShotMap } from "./[sessionId]/lazy-round-shot-map";
import styles from "./mobile-round-shot-map.module.css";

export function MobileRoundShotMap({
  holes,
  shots,
  courseName,
  shotMode = "actual",
}: {
  holes: RoundMapHole[];
  shots: RoundMapShot[];
  courseName: string;
  shotMode?: "actual" | "estimated";
}) {
  const query = useSearchParams();
  const requested = Number(query.get("hole"));
  const index = Math.max(
    0,
    holes.findIndex((h) => h.holeNumber === requested),
  );
  const hole = holes[index];
  const distance: DistanceMode = query.get("mapDistance") === "carry" ? "carry" : "total";
  const satellite = query.get("mapView") === "satellite";
  const byHole = useMemo(() => groupShotsByHole(shots), [shots]);
  const [sheet, setSheet] = useState<"options" | "shot" | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  if (!hole)
    return (
      <p className="mobile-type-callout text-muted-foreground">No mapped holes are available.</p>
    );
  const holeShots = byHole.get(hole.holeNumber) ?? [];
  const selected = holeShots.find((s) => s.id === query.get("shot")) ?? holeShots[0] ?? null;
  const estimated = shotMode === "estimated";
  const hasGeometry = hole.geometry.length >= 2;
  const plottableShots = holeShots.filter(
    (shot) =>
      roundMapDistanceReading(shot, distance).value !== null ||
      (distance === "total" && shot.distanceRemainingYd !== null),
  );
  const projected = hasGeometry ? projectHoleShots(hole, plottableShots, distance) : [];
  const project = roundMapViewport(hole, projected);
  const path = hole.geometry.map((p) => project(p).join(",")).join(" ");
  const tee = hole.geometry[0] ? project(hole.geometry[0]) : null;
  const green = hole.geometry.at(-1) ? project(hole.geometry.at(-1)!) : null;
  function update(values: Record<string, string | null>) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "map");
    for (const [key, value] of Object.entries(values)) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    window.history.replaceState(null, "", url);
  }
  function changeHole(next: number) {
    const nextHole = holes[next];
    if (!nextHole) return;
    update({ hole: String(nextHole.holeNumber), shot: null });
    setSheet(null);
  }
  function selectShot(shot: RoundMapShot) {
    update({ hole: String(hole.holeNumber), shot: shot.id });
    setSheet("shot");
  }
  return (
    <section className={styles.screen} aria-label="Round hole map" data-mobile-round-map>
      <div className={styles.navigation}>
        <button
          aria-label="Previous hole"
          disabled={index === 0}
          onClick={() => changeHole(index - 1)}
        >
          <ChevronLeft aria-hidden />
        </button>
        <div>
          <span className={styles.picker}>
            <select
              aria-label="Map hole"
              value={hole.holeNumber}
              onChange={(e) =>
                changeHole(holes.findIndex((h) => h.holeNumber === Number(e.target.value)))
              }
            >
              {holes.map((h) => (
                <option key={h.holeNumber} value={h.holeNumber}>
                  Hole {h.holeNumber}
                </option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden />
          </span>
          <p className="mobile-type-footnote text-muted-foreground">
            Par {hole.par} · {hole.yards} yd{hole.score !== null ? ` · Score ${hole.score}` : ""}
          </p>
        </div>
        <button
          aria-label="Next hole"
          disabled={index === holes.length - 1}
          onClick={() => changeHole(index + 1)}
        >
          <ChevronRight aria-hidden />
        </button>
      </div>
      <div
        className={styles.map}
        onTouchStart={(e) => {
          if (
            satellite ||
            e.touches.length !== 1 ||
            (e.target as Element).closest("[role=button],button")
          ) {
            swipe.current = null;
            return;
          }
          swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start || !e.changedTouches.length) return;
          const dx = e.changedTouches[0].clientX - start.x,
            dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5)
            changeHole(index + (dx < 0 ? 1 : -1));
        }}
        onTouchCancel={() => {
          swipe.current = null;
        }}
      >
        {hasGeometry ? (
          satellite ? (
            <div className={styles.satellite}>
              <LazyRoundShotMap
                key={`${hole.holeNumber}-${distance}`}
                holes={[hole]}
                shots={plottableShots}
                courseName={courseName}
                shotMode={shotMode}
                compact
                initialHoleNumber={hole.holeNumber}
                initialDistanceMode={distance}
                activeShotId={selected?.id ?? null}
                onShotSelect={(id) => {
                  const shot = holeShots.find((candidate) => candidate.id === id);
                  if (shot) selectShot(shot);
                }}
              />
            </div>
          ) : (
            <svg
              viewBox="0 0 320 340"
              aria-label={`Hole ${hole.holeNumber}, course centre line and ${projected.length} projected ${estimated ? "estimated strokes" : "shots"}`}
            >
              <polyline points={path} className={styles.centreline} />
              {projected.map((p) => {
                const a = project(p.start),
                  b = project(p.end);
                return (
                  <line
                    key={p.shot.id}
                    x1={a[0]}
                    y1={a[1]}
                    x2={b[0]}
                    y2={b[1]}
                    className={styles.shotPath}
                    data-selected={p.shot.id === selected?.id}
                    strokeDasharray={estimated ? "5 5" : undefined}
                  />
                );
              })}
              {tee ? (
                <g aria-hidden>
                  <circle cx={tee[0]} cy={tee[1]} r="7" className={styles.tee} />
                  <text x={tee[0] + 13} y={tee[1] + 5}>
                    Tee
                  </text>
                </g>
              ) : null}
              {green ? (
                <g aria-hidden>
                  <circle cx={green[0]} cy={green[1]} r="10" className={styles.green} />
                  <text x={green[0] + 15} y={green[1] + 5}>
                    Green
                  </text>
                </g>
              ) : null}
              {/* Larger hit areas sit behind every visible marker, so nearby shots stay tappable. */}
              {projected.map((p) => {
                const end = project(p.end);
                return (
                  <circle
                    key={`hit-${p.shot.id}`}
                    cx={end[0]}
                    cy={end[1]}
                    r="25"
                    fill="transparent"
                    aria-hidden
                    onClick={() => selectShot(p.shot)}
                  />
                );
              })}
              {projected.map((p, i) => {
                const end = project(p.end);
                return (
                  <g
                    key={p.shot.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect ${estimated ? "estimated stroke" : "shot"} ${p.shot.holeShotNumber ?? i + 1}, ${formatCompanionClubType(p.shot.clubType)}`}
                    onClick={() => selectShot(p.shot)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectShot(p.shot);
                      }
                    }}
                    className={styles.marker}
                    data-selected={p.shot.id === selected?.id}
                  >
                    <circle
                      cx={end[0]}
                      cy={end[1]}
                      r="25"
                      fill="transparent"
                      pointerEvents="none"
                    />
                    <circle cx={end[0]} cy={end[1]} r="12" className={styles.dot} />
                    <text x={end[0]} y={end[1] + 4} textAnchor="middle">
                      {p.shot.holeShotNumber ?? i + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          )
        ) : (
          <p className="p-4">No course outline is available for this hole.</p>
        )}
      </div>
      <div className={styles.caption}>
        <p>
          {estimated
            ? "Estimated strokes · scorecard only"
            : "Projected positions · saved distances"}
        </p>
        <button aria-label="Map options" onClick={() => setSheet("options")}>
          <SlidersHorizontal size={18} aria-hidden />
          <span>{distance === "carry" ? "Carry" : "Total"}</span>
        </button>
      </div>
      {holeShots.length ? (
        <MobileGroupedList
          label={estimated ? "Estimated strokes on this hole" : "Shots on this hole"}
        >
          {holeShots.map((shot, i) => {
            const reading = roundMapDistanceReading(shot, distance);
            return (
              <MobileListRow
                key={shot.id}
                onClick={() => selectShot(shot)}
                label={`${shot.holeShotNumber ?? i + 1} · ${formatCompanionClubType(shot.clubType)}`}
                value={reading.value === null ? "—" : `${format(reading.value)} yd`}
                detail={`${estimated ? "Estimated " : ""}${reading.value === null ? "Distance unavailable" : reading.label}${reading.fallback && reading.value !== null ? ` · ${distance} unavailable` : ""}${shot.sideCarryYd !== null ? ` · ${side(shot.sideCarryYd)}` : ""}`}
              />
            );
          })}
        </MobileGroupedList>
      ) : (
        <p className="mobile-type-callout text-muted-foreground">
          {estimated
            ? "No scorecard strokes are available for this hole."
            : "No measured shots are linked to this hole."}
        </p>
      )}
      <Drawer
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {sheet === "options"
                ? "Map options"
                : selected
                  ? `${formatCompanionClubType(selected.clubType)} · Hole ${hole.holeNumber}`
                  : "Shot details"}
            </DrawerTitle>
            <DrawerDescription>
              {estimated
                ? "Estimated from the scorecard. These markers do not count as measured performance."
                : "Positions are projected from recorded distances along the course centre line; they are not GPS tracks."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-4">
            {sheet === "options" ? (
              <>
                <MobileSegmentedControl
                  ariaLabel="Map background"
                  value={satellite ? "satellite" : "course"}
                  options={[
                    { value: "course", label: "Course" },
                    { value: "satellite", label: "Satellite" },
                  ]}
                  onValueChange={(value) => update({ mapView: value })}
                />
                <MobileSegmentedControl
                  ariaLabel="Map distance"
                  value={distance}
                  options={[
                    { value: "total", label: "Total" },
                    { value: "carry", label: "Carry" },
                  ]}
                  onValueChange={(value) => update({ mapDistance: value })}
                />
                <p className="mobile-type-footnote text-muted-foreground">
                  Course view uses the saved outline and needs no satellite imagery. A missing
                  distance uses the other recorded distance and is labelled in the shot list.
                </p>
              </>
            ) : selected ? (
              <MobileGroupedList label="Shot measurements">
                {[
                  ["Carry", selected.carryYd],
                  ["Total", selected.totalYd],
                  ["Remaining", selected.distanceRemainingYd],
                ].map(([label, value]) =>
                  typeof value === "number" ? (
                    <MobileListRow
                      key={label as string}
                      label={label}
                      value={`${format(value)} yd`}
                    />
                  ) : null,
                )}
                {selected.sideCarryYd !== null ? (
                  <MobileListRow label="Side" value={side(selected.sideCarryYd)} />
                ) : (
                  <MobileListRow
                    label="Side unavailable"
                    detail="The map uses the centre line where lateral data is missing."
                  />
                )}
              </MobileGroupedList>
            ) : null}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="min-h-11">
                Done
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
function format(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
}
function side(value: number) {
  return value === 0 ? "On line" : `${format(Math.abs(value))} yd ${value > 0 ? "right" : "left"}`;
}
