"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClubType } from "@/lib/rapsodo/parser";
import {
  YARDS_TO_METERS,
  destinationPoint,
  forwardDistanceYd,
  pointAlongGeometry,
} from "@/lib/geo/yard-projection";

export type RoundMapHole = {
  holeNumber: number;
  par: number;
  yards: number;
  score: number | null;
  putts: number | null;
  geometry: Array<[number, number]>;
};

export type RoundMapShot = {
  id: string;
  holeNumber: number | null;
  holeShotNumber: number | null;
  shotNumber: number | null;
  clubType: string;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  distanceRemainingYd: number | null;
  courseHoleYards: number | null;
};

type ProjectedShot = {
  shot: RoundMapShot;
  start: [number, number];
  end: [number, number];
};

type RoundShotMapProps = {
  holes: RoundMapHole[];
  shots: RoundMapShot[];
  courseName: string;
  shotMode?: "actual" | "estimated";
};

type DistanceMode = "total" | "carry";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function RoundShotMap({ holes, shots, courseName, shotMode = "actual" }: RoundShotMapProps) {
  const [mapContainerNode, setMapContainerNode] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const [leaflet, setLeaflet] = useState<typeof Leaflet | null>(null);
  const [tileReady, setTileReady] = useState(false);
  const [mapMode, setMapMode] = useState<"course" | "satellite">("satellite");
  const [distanceMode, setDistanceMode] = useState<DistanceMode>("total");
  const [showShotNumbers, setShowShotNumbers] = useState(true);
  const [showAllHoleShots, setShowAllHoleShots] = useState(false);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [selectedHoleNumber, setSelectedHoleNumber] = useState(() => holes[0]?.holeNumber ?? 1);
  const selectedHole =
    holes.find((hole) => hole.holeNumber === selectedHoleNumber) ?? holes[0] ?? null;
  const selectedHoleIndex = holes.findIndex((hole) => hole.holeNumber === selectedHole?.holeNumber);
  const shotsByHole = useMemo(() => groupShotsByHole(shots), [shots]);
  const selectedShots = useMemo(() => {
    if (!selectedHole) {
      return [];
    }

    return shotsByHole.get(selectedHole.holeNumber) ?? [];
  }, [selectedHole, shotsByHole]);
  const projectedSelectedShots = useMemo(
    () => (selectedHole ? projectHoleShots(selectedHole, selectedShots, distanceMode) : []),
    [distanceMode, selectedHole, selectedShots],
  );
  const allProjectedShots = useMemo(
    () =>
      holes.flatMap((hole) =>
        projectHoleShots(hole, shotsByHole.get(hole.holeNumber) ?? [], distanceMode),
      ),
    [distanceMode, holes, shotsByHole],
  );
  const visibleProjectedShots = showAllHoleShots ? allProjectedShots : projectedSelectedShots;
  const selectedShot =
    selectedShots.find((shot) => shot.id === selectedShotId) ?? selectedShots[0] ?? null;
  const isEstimated = shotMode === "estimated";
  const setMapContainerRef = useCallback((node: HTMLDivElement | null) => {
    setMapContainerNode(node);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function setupMap() {
      try {
        const L = await import("leaflet");

        if (!isMounted || !mapContainerNode || mapRef.current) {
          if (isMounted) {
            setLeaflet(L);
          }
          return;
        }

        const map = L.map(mapContainerNode, {
          zoomControl: false,
          scrollWheelZoom: true,
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.control.scale({ imperial: true, metric: false, position: "bottomleft" }).addTo(map);
        const tileLayer = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 20,
            attribution:
              "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          },
        );
        tileLayer.on("load", () => {
          if (isMounted) {
            setTileReady(true);
          }
        });
        tileLayer.on("tileload", () => {
          if (isMounted) {
            setTileReady(true);
          }
        });
        tileLayer.addTo(map);

        const layers = L.layerGroup().addTo(map);
        mapRef.current = map;
        layerRef.current = layers;
        setLeaflet(L);
      } catch {
        if (isMounted) {
          setLeaflet(null);
          setTileReady(false);
        }
      }
    }

    void setupMap();

    return () => {
      isMounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      setTileReady(false);
    };
  }, [mapContainerNode]);

  useEffect(() => {
    if (!mapContainerNode || !mapRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        mapRef.current?.invalidateSize();
      });
    });
    resizeObserver.observe(mapContainerNode);
    const timeout = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 100);

    return () => {
      resizeObserver.disconnect();
      window.clearTimeout(timeout);
    };
  }, [mapContainerNode, leaflet]);

  useEffect(() => {
    if (!leaflet || !mapRef.current || !layerRef.current || holes.length === 0) {
      return;
    }

    const L = leaflet;
    const layers = layerRef.current;
    layers.clearLayers();

    for (const hole of holes) {
      const isSelected = hole.holeNumber === selectedHoleNumber;

      L.polyline(hole.geometry, {
        color: isSelected ? "#f8fafc" : "#ffffff",
        weight: isSelected ? 9 : 5,
        opacity: isSelected ? 0.95 : 0.34,
      }).addTo(layers);
      L.polyline(hole.geometry, {
        color: isSelected ? "#22c55e" : "#a7f3d0",
        weight: isSelected ? 4 : 2,
        opacity: isSelected ? 0.98 : 0.42,
      }).addTo(layers);

      const tee = hole.geometry[0];
      const green = hole.geometry[hole.geometry.length - 1];

      L.circleMarker(tee, {
        radius: isSelected ? 7 : 4,
        color: "#111827",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(`Hole ${hole.holeNumber} tee`)
        .addTo(layers);
      L.circleMarker(green, {
        radius: isSelected ? 8 : 5,
        color: "#16a34a",
        fillColor: "#dcfce7",
        fillOpacity: 0.95,
        weight: 2,
      })
        .bindTooltip(`Hole ${hole.holeNumber} green`)
        .addTo(layers);
    }

    if (selectedHole) {
      for (const projected of visibleProjectedShots) {
        const isSelectedHole = projected.shot.holeNumber === selectedHoleNumber;
        const isActive = projected.shot.id === selectedShot?.id;
        const lineColor = isSelectedHole ? "#38bdf8" : "#f59e0b";
        const markerFill = isActive ? "#f8fafc" : lineColor;
        const markerStroke = isActive ? "#0f172a" : "#0f172a";
        const primaryLine = L.polyline([projected.start, projected.end], {
          color: lineColor,
          weight: isActive ? 7 : isSelectedHole ? 4 : 3,
          opacity: isSelectedHole ? 0.95 : 0.56,
        })
          .bindPopup(shotPopup(projected.shot, distanceMode))
          .on("click", () => {
            setSelectedShotId(projected.shot.id);
            if (projected.shot.holeNumber) {
              setSelectedHoleNumber(projected.shot.holeNumber);
            }
          })
          .addTo(layers);

        primaryLine.bringToFront();
        L.polyline([projected.start, projected.end], {
          color: "#020617",
          weight: 1,
          opacity: isSelectedHole ? 0.38 : 0.24,
          dashArray: "4 6",
        }).addTo(layers);
        L.circleMarker(projected.end, {
          radius: isActive ? 9 : 7,
          color: markerStroke,
          fillColor: markerFill,
          fillOpacity: 1,
          weight: isActive ? 3 : 2,
        })
          .bindPopup(shotPopup(projected.shot, distanceMode))
          .on("click", () => {
            setSelectedShotId(projected.shot.id);
            if (projected.shot.holeNumber) {
              setSelectedHoleNumber(projected.shot.holeNumber);
            }
          })
          .addTo(layers);

        if (showShotNumbers) {
          L.marker(projected.end, {
            interactive: false,
            icon: L.divIcon({
              className: "",
              html: `<span style="display:flex;height:22px;width:22px;align-items:center;justify-content:center;border-radius:9999px;background:#f8fafc;color:#0f172a;border:2px solid #0f172a;font:700 11px system-ui,sans-serif;">${projected.shot.holeShotNumber ?? projected.shot.shotNumber ?? ""}</span>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            }),
          }).addTo(layers);
        }
      }

      const selectedBounds = L.latLngBounds([
        ...(showAllHoleShots ? holes.flatMap((hole) => hole.geometry) : selectedHole.geometry),
        ...(showAllHoleShots ? allProjectedShots : projectedSelectedShots).map(
          (projected) => projected.end,
        ),
      ]);
      mapRef.current.invalidateSize();
      mapRef.current.fitBounds(selectedBounds.pad(showAllHoleShots ? 0.12 : 0.45), {
        animate: false,
        maxZoom: showAllHoleShots ? 16 : 18,
      });
    } else {
      mapRef.current.invalidateSize();
      mapRef.current.fitBounds(L.latLngBounds(holes.flatMap((hole) => hole.geometry)).pad(0.12), {
        animate: false,
      });
    }
  }, [
    distanceMode,
    allProjectedShots,
    holes,
    leaflet,
    projectedSelectedShots,
    selectedHole,
    selectedHoleNumber,
    selectedShot?.id,
    showAllHoleShots,
    showShotNumbers,
    visibleProjectedShots,
  ]);

  useEffect(() => {
    if (mapMode === "satellite") {
      mapRef.current?.invalidateSize();
    }
  }, [mapMode]);

  if (holes.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
      <div className="apple-panel space-y-4 p-4">
        <div className="space-y-1">
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            {isEstimated ? "Estimated shot overlay" : "Actual hole overlay"}
          </Badge>
          <h2 className="text-2xl font-semibold tracking-normal">{courseName}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {isEstimated
              ? "Estimated from the scorecard only. These visual markers are not included in bag, shot, or simulator stats."
              : "Satellite map with OpenStreetMap hole geometry. Shot endpoints are projected from the saved total distance and side-carry data."}
          </p>
        </div>
        {selectedHole ? (
          <>
            <div className="apple-panel-strong p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Viewing
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-normal">
                    Hole {selectedHole.holeNumber}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selectedHoleIndex <= 0}
                    onClick={() => {
                      const previousHole = holes[Math.max(0, selectedHoleIndex - 1)];
                      if (previousHole) {
                        setSelectedHoleNumber(previousHole.holeNumber);
                      }
                    }}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selectedHoleIndex === -1 || selectedHoleIndex >= holes.length - 1}
                    onClick={() => {
                      const nextHole = holes[Math.min(holes.length - 1, selectedHoleIndex + 1)];
                      if (nextHole) {
                        setSelectedHoleNumber(nextHole.holeNumber);
                      }
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MapMetric label="Par" value={selectedHole.par.toString()} />
              <MapMetric
                label={isEstimated ? "Est shots" : "Shots"}
                value={selectedShots.length.toString()}
              />
              <MapMetric label="Yards" value={selectedHole.yards.toString()} />
              <MapMetric label="Score" value={selectedHole.score?.toString() ?? "--"} />
              <MapMetric label="Putts" value={selectedHole.putts?.toString() ?? "--"} />
              <MapMetric label="Mode" value={mapMode === "satellite" ? "Satellite" : "Course"} />
            </div>
          </>
        ) : null}
        <div className="grid grid-cols-6 gap-2">
          {holes.map((hole) => (
            <Button
              key={hole.holeNumber}
              type="button"
              variant={hole.holeNumber === selectedHoleNumber ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-11 rounded-lg text-sm font-semibold",
                hole.holeNumber === selectedHoleNumber && "bg-[#0B7A3B] text-white",
              )}
              onClick={() => setSelectedHoleNumber(hole.holeNumber)}
            >
              <span>{hole.holeNumber}</span>
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          {selectedShots.map((shot) => (
            <div
              key={shot.id}
              className={cn(
                "apple-panel-strong p-3",
                shot.id === selectedShot?.id && "border-[#111827] shadow-sm",
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setSelectedShotId(shot.id)}
              >
                <div>
                  <p className="text-sm font-medium">
                    {shot.holeShotNumber ? `#${shot.holeShotNumber}` : "Shot"}{" "}
                    {formatClubType(shot.clubType)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isEstimated ? "Estimated" : "Carry"} {formatMetric(shot.carryYd)} yd - Total{" "}
                    {formatMetric(shot.totalYd)} yd
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatSide(shot.sideCarryYd)}</span>
              </button>
            </div>
          ))}
          {selectedShots.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-white/80 px-3 py-6 text-center text-sm text-muted-foreground">
              {isEstimated
                ? "No scorecard strokes are available to estimate for this hole yet."
                : "No launch monitor shots are assigned to this hole yet."}
            </div>
          ) : null}
        </div>
      </div>
      <div className="space-y-3">
        <div className="map-frame relative h-[68vh] min-h-[360px] lg:h-[560px] lg:min-h-[420px]">
          {selectedHole ? (
            <HoleVectorFallback
              hole={selectedHole}
              holes={holes}
              projectedShots={visibleProjectedShots}
              selectedShotId={selectedShot?.id ?? null}
              className={mapMode === "satellite" ? "opacity-0" : "opacity-100"}
              showAllHoleShots={showAllHoleShots}
              showShotNumbers={showShotNumbers}
              showSatelliteHint={mapMode === "satellite" && !tileReady}
              onSelectShot={(shot) => {
                setSelectedShotId(shot.id);
                if (shot.holeNumber) {
                  setSelectedHoleNumber(shot.holeNumber);
                }
              }}
            />
          ) : null}
          <div
            ref={setMapContainerRef}
            className={cn(
              "absolute inset-0 z-10 h-full w-full bg-[#101827] transition-opacity duration-300",
              mapMode === "satellite" ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />
          <div className="absolute left-3 right-3 top-3 z-20 flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
            <div className="w-fit rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#111827] shadow-sm">
              {selectedHole
                ? `Hole ${selectedHole.holeNumber} - ${selectedHole.yards} yd`
                : "Hole map"}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex w-fit rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                <Button
                  type="button"
                  size="sm"
                  variant={distanceMode === "total" ? "default" : "ghost"}
                  className={cn(
                    "h-8 rounded-[6px]",
                    distanceMode === "total" && "bg-[#0B7A3B] text-white",
                  )}
                  onClick={() => setDistanceMode("total")}
                >
                  Total
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={distanceMode === "carry" ? "default" : "ghost"}
                  className={cn(
                    "h-8 rounded-[6px]",
                    distanceMode === "carry" && "bg-[#0B7A3B] text-white",
                  )}
                  onClick={() => setDistanceMode("carry")}
                >
                  Carry
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant={showAllHoleShots ? "default" : "secondary"}
                className={cn(
                  "h-10 rounded-lg border border-slate-200 bg-white shadow-sm",
                  showAllHoleShots && "bg-[#0B7A3B] text-white",
                )}
                onClick={() => setShowAllHoleShots((current) => !current)}
              >
                All holes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={showShotNumbers ? "default" : "secondary"}
                className={cn(
                  "h-10 rounded-lg border border-slate-200 bg-white shadow-sm",
                  showShotNumbers && "bg-[#0B7A3B] text-white",
                )}
                onClick={() => setShowShotNumbers((current) => !current)}
              >
                Numbers
              </Button>
              <div className="flex w-fit rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                <Button
                  type="button"
                  size="sm"
                  variant={mapMode === "course" ? "default" : "ghost"}
                  className={cn(
                    "h-8 rounded-[6px]",
                    mapMode === "course" && "bg-[#0B7A3B] text-white",
                  )}
                  onClick={() => setMapMode("course")}
                >
                  Course
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mapMode === "satellite" ? "default" : "ghost"}
                  className={cn(
                    "h-8 rounded-[6px]",
                    mapMode === "satellite" && "bg-[#0B7A3B] text-white",
                  )}
                  onClick={() => setMapMode("satellite")}
                >
                  Satellite
                </Button>
              </div>
            </div>
          </div>
        </div>
        {selectedShot ? (
          <div className="apple-panel-strong p-3 text-[#111827]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Selected shot
                </p>
                <p className="mt-1 text-base font-semibold">
                  #{selectedShot.holeShotNumber ?? selectedShot.shotNumber ?? "--"}{" "}
                  {formatClubType(selectedShot.clubType)}
                </p>
              </div>
              <Badge variant="secondary">Hole {selectedShot.holeNumber ?? "--"}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MapMetric label="Carry" value={`${formatMetric(selectedShot.carryYd)} yd`} />
              <MapMetric label="Total" value={`${formatMetric(selectedShot.totalYd)} yd`} />
              <MapMetric label="Side" value={formatSide(selectedShot.sideCarryYd)} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MapMetric
                label="Remaining"
                value={`${formatMetric(selectedShot.distanceRemainingYd)} yd`}
              />
              <MapMetric label="View" value={distanceMode === "carry" ? "Carry" : "Total"} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HoleVectorFallback({
  hole,
  holes,
  projectedShots,
  selectedShotId,
  className,
  showAllHoleShots,
  showShotNumbers,
  showSatelliteHint = false,
  onSelectShot,
}: {
  hole: RoundMapHole;
  holes: RoundMapHole[];
  projectedShots: ProjectedShot[];
  selectedShotId: string | null;
  className?: string;
  showAllHoleShots: boolean;
  showShotNumbers: boolean;
  showSatelliteHint?: boolean;
  onSelectShot: (shot: RoundMapShot) => void;
}) {
  const renderedHoles = showAllHoleShots ? holes : [hole];
  const allPoints = [
    ...renderedHoles.flatMap((renderedHole) => renderedHole.geometry),
    ...projectedShots.flatMap((projected) => [projected.start, projected.end]),
  ];
  const bounds = localBounds(allPoints);
  const centerline = hole.geometry.map((point) => toSvgPoint(point, bounds));

  return (
    <div
      className={cn("absolute inset-0 z-0 bg-[#101827] transition-opacity duration-300", className)}
    >
      <svg
        viewBox="0 0 800 520"
        className="h-full w-full"
        role="img"
        aria-label={`Hole ${hole.holeNumber} shot overlay`}
      >
        <defs>
          <pattern
            id={`mow-${hole.holeNumber}`}
            patternUnits="userSpaceOnUse"
            width="28"
            height="28"
            patternTransform="rotate(28)"
          >
            <rect width="28" height="28" fill="#214f34" />
            <rect width="14" height="28" fill="#2d6843" opacity="0.72" />
          </pattern>
          <filter id={`glow-${hole.holeNumber}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="800" height="520" fill="#101827" />
        {renderedHoles.map((renderedHole) => {
          const renderedCenterline = renderedHole.geometry.map((point) =>
            toSvgPoint(point, bounds),
          );
          const isSelectedHole = renderedHole.holeNumber === hole.holeNumber;

          return (
            <g key={renderedHole.holeNumber} opacity={isSelectedHole ? 1 : 0.58}>
              <polyline
                points={pointsAttr(renderedCenterline)}
                fill="none"
                stroke="#17331f"
                strokeWidth={isSelectedHole ? "94" : "68"}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={pointsAttr(renderedCenterline)}
                fill="none"
                stroke={`url(#mow-${hole.holeNumber})`}
                strokeWidth={isSelectedHole ? "74" : "50"}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.98"
              />
              <polyline
                points={pointsAttr(renderedCenterline)}
                fill="none"
                stroke="#f8fafc"
                strokeWidth="2"
                strokeDasharray="10 12"
                strokeLinecap="round"
                opacity="0.86"
              />
              {showAllHoleShots && renderedCenterline[0] ? (
                <text
                  x={renderedCenterline[0].x - 8}
                  y={renderedCenterline[0].y - 12}
                  fill="#e5e7eb"
                  fontSize="13"
                  fontWeight="800"
                >
                  {renderedHole.holeNumber}
                </text>
              ) : null}
            </g>
          );
        })}
        {yardageRings(centerline).map((ring, index) => (
          <g key={`${ring.x}-${ring.y}`}>
            <line
              x1={ring.x - 50}
              x2={ring.x + 50}
              y1={ring.y}
              y2={ring.y}
              stroke="#f8fafc"
              strokeOpacity="0.45"
            />
            <text x={ring.x + 58} y={ring.y + 4} fill="#e5e7eb" fontSize="14" fontWeight="600">
              {Math.round(((index + 1) / 4) * hole.yards)}
            </text>
          </g>
        ))}
        {projectedShots.map((projected) => {
          const start = toSvgPoint(projected.start, bounds);
          const end = toSvgPoint(projected.end, bounds);
          const isSelected = projected.shot.id === selectedShotId;

          return (
            <g
              key={projected.shot.id}
              role="button"
              tabIndex={0}
              aria-label={`Select ${formatClubType(projected.shot.clubType)} shot ${
                projected.shot.holeShotNumber ?? projected.shot.shotNumber ?? ""
              }`}
              className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onClick={() => onSelectShot(projected.shot)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectShot(projected.shot);
                }
              }}
            >
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={isSelected ? "#f8fafc" : "#38bdf8"}
                strokeWidth={isSelected ? "8" : "5"}
                strokeLinecap="round"
                filter={`url(#glow-${hole.holeNumber})`}
              />
              <circle
                cx={end.x}
                cy={end.y}
                r={isSelected ? "13" : "11"}
                fill={isSelected ? "#f8fafc" : "#38bdf8"}
                stroke={isSelected ? "#0f172a" : "#f8fafc"}
                strokeWidth="3"
              />
              {showShotNumbers ? (
                <text
                  x={end.x}
                  y={end.y + 4}
                  textAnchor="middle"
                  fill="#0f172a"
                  fontSize="11"
                  fontWeight="800"
                >
                  {projected.shot.holeShotNumber ?? projected.shot.shotNumber ?? ""}
                </text>
              ) : null}
            </g>
          );
        })}
        {centerline[0] ? (
          <circle
            cx={centerline[0].x}
            cy={centerline[0].y}
            r="12"
            fill="#f8fafc"
            stroke="#111827"
            strokeWidth="4"
          />
        ) : null}
        {centerline.at(-1) ? (
          <circle
            cx={centerline.at(-1)?.x}
            cy={centerline.at(-1)?.y}
            r="16"
            fill="#bbf7d0"
            stroke="#22c55e"
            strokeWidth="5"
          />
        ) : null}
        <text x="30" y="44" fill="#f8fafc" fontSize="24" fontWeight="800">
          Hole {hole.holeNumber}
        </text>
        <text x="30" y="74" fill="#cbd5e1" fontSize="15">
          Par {hole.par} - {hole.yards} yd - {projectedShots.length} shots
        </text>
      </svg>
      {showSatelliteHint ? (
        <div className="absolute bottom-3 left-3 rounded-lg bg-black/55 px-3 py-2 text-xs text-white">
          Satellite tiles are still loading. Showing course view.
        </div>
      ) : null}
    </div>
  );
}

function MapMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/88 p-3 ring-1 ring-slate-200/80">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function localBounds(points: Array<[number, number]>) {
  const lats = points.map((point) => point[0]);
  const lngs = points.map((point) => point[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPadding = Math.max(0.00025, (maxLat - minLat) * 0.2);
  const lngPadding = Math.max(0.00025, (maxLng - minLng) * 0.2);

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding,
  };
}

function toSvgPoint(
  point: [number, number],
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
) {
  const width = bounds.maxLng - bounds.minLng || 1;
  const height = bounds.maxLat - bounds.minLat || 1;

  return {
    x: 54 + ((point[1] - bounds.minLng) / width) * 692,
    y: 54 + ((bounds.maxLat - point[0]) / height) * 412,
  };
}

function pointsAttr(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function yardageRings(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) {
    return [];
  }

  const first = points[0];
  const last = points[points.length - 1];

  return [0.25, 0.5, 0.75].map((ratio) => ({
    x: first.x + (last.x - first.x) * ratio,
    y: first.y + (last.y - first.y) * ratio,
  }));
}

function groupShotsByHole(shots: RoundMapShot[]) {
  const shotsByHole = new Map<number, RoundMapShot[]>();

  for (const shot of shots) {
    if (shot.holeNumber === null) {
      continue;
    }

    const holeShots = shotsByHole.get(shot.holeNumber) ?? [];
    holeShots.push(shot);
    shotsByHole.set(shot.holeNumber, holeShots);
  }

  for (const holeShots of shotsByHole.values()) {
    holeShots.sort(
      (left, right) =>
        (left.holeShotNumber ?? left.shotNumber ?? 0) -
        (right.holeShotNumber ?? right.shotNumber ?? 0),
    );
  }

  return shotsByHole;
}

function projectHoleShots(
  hole: RoundMapHole,
  shots: RoundMapShot[],
  distanceMode: DistanceMode = "total",
) {
  const projectedShots: ProjectedShot[] = [];
  let previousEnd = hole.geometry[0];
  let fallbackProgressYd = 0;

  for (const shot of shots) {
    const holeYards = shot.courseHoleYards ?? hole.yards;
    const distanceYd = shotDistanceForMode(shot, distanceMode);
    const shotForwardYd = forwardDistanceYd(distanceYd, shot.sideCarryYd);
    fallbackProgressYd += shotForwardYd ?? 0;
    const progressYd =
      distanceMode === "carry" || shot.distanceRemainingYd === null
        ? fallbackProgressYd
        : Math.max(0, holeYards - shot.distanceRemainingYd);
    const projected = pointAlongGeometry(hole.geometry, Math.min(1, progressYd / holeYards));
    const sideYd = shot.sideCarryYd ?? 0;
    const sideBearing = projected.bearingDeg + (sideYd >= 0 ? 90 : -90);
    const end = destinationPoint(projected.point, sideBearing, Math.abs(sideYd) * YARDS_TO_METERS);

    projectedShots.push({
      shot,
      start: previousEnd,
      end,
    });
    previousEnd = end;
  }

  return projectedShots;
}

function shotDistanceForMode(shot: RoundMapShot, distanceMode: DistanceMode) {
  return distanceMode === "carry" ? (shot.carryYd ?? shot.totalYd) : (shot.totalYd ?? shot.carryYd);
}

function shotPopup(shot: RoundMapShot, distanceMode: DistanceMode = "total") {
  return [
    `<strong>Shot ${shot.holeShotNumber ?? shot.shotNumber ?? ""}</strong>`,
    `${formatClubType(shot.clubType)}`,
    `Plotted: ${formatMetric(shotDistanceForMode(shot, distanceMode))} yd ${
      distanceMode === "carry" ? "carry" : "total"
    }`,
    `Carry: ${formatMetric(shot.carryYd)} yd`,
    `Total: ${formatMetric(shot.totalYd)} yd`,
    `Side: ${formatSide(shot.sideCarryYd)}`,
  ].join("<br />");
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatSide(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value === 0) {
    return "0 yd";
  }

  return `${numberFormatter.format(Math.abs(value))}${value > 0 ? "R" : "L"}`;
}
