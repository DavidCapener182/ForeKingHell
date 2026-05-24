"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  classifyLandingPoint,
  classifyProjectedPatternPoints,
  type CourseFeature,
  type LandingClassificationSummary,
} from "@/lib/course-feature-classification";
import type { LatLngPoint } from "@/lib/geo/yard-projection";
import type {
  ProjectedShotPatternPoint,
  ProjectedShotPatternResult,
  ProjectedShotPatternSummary,
} from "@/lib/shot-pattern-projection";
import { projectShotPatternOntoHole } from "@/lib/shot-pattern-projection";
import {
  buildShotPatternTargetLine,
  clampTargetAimOffset,
  clampTargetDistance,
  nearestTargetPlacementOnGeometry,
  type ShotPatternTargetLine,
  type TargetSurfaceStatus,
} from "@/lib/shot-pattern-target";
import type {
  ShotPatternClubOption,
  ShotPatternMode,
  ShotPatternOutlierMode,
  ShotPatternResult,
} from "@/lib/shot-patterns";
import type {
  ShotPatternHoleOption,
  ShotPatternTeeSetOption,
} from "@/lib/shot-pattern-overlay-data";
import { ShotPatternSummaryDrawer } from "@/components/maps/shot-pattern-summary-drawer";

type ShotPatternApiData = {
  hole: {
    holeNumber: number;
    par: number;
    yards: number;
    geometry: LatLngPoint[];
  } | null;
  club: {
    id: string | null;
    type: string;
    label: string;
  };
  pattern: ShotPatternResult;
  projectedPoints: ProjectedShotPatternPoint[];
  projectedSummary: ProjectedShotPatternSummary;
  landingSummary: LandingClassificationSummary;
  courseFeatures: CourseFeature[];
  clubOptions: ShotPatternClubOption[];
};

type ShotPatternMapProps = {
  courseId: string;
  courseName: string;
  teeSets: ShotPatternTeeSetOption[];
  holes: ShotPatternHoleOption[];
  holesByTeeSet: Record<string, ShotPatternHoleOption[]>;
  clubOptions: ShotPatternClubOption[];
  initialData?: ShotPatternApiData | null;
  defaultControls: {
    teeSetId: string | null;
    holeNumber: number | null;
    clubId: string | null;
    clubType: string;
    mode: ShotPatternMode;
    outlierMode: ShotPatternOutlierMode;
  };
};

type ClubSelection = {
  clubId: string | null;
  clubType: string;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});
const AIM_LINE_LABEL_RATIO = 0.34;

export function ShotPatternMap({
  courseId,
  courseName,
  teeSets,
  holes,
  holesByTeeSet,
  clubOptions,
  initialData = null,
  defaultControls,
}: ShotPatternMapProps) {
  const [mapContainerNode, setMapContainerNode] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const fitBoundsKeyRef = useRef<string | null>(null);
  const [leaflet, setLeaflet] = useState<typeof Leaflet | null>(null);
  const [tileReady, setTileReady] = useState(false);
  const [loadedSatelliteImageUrl, setLoadedSatelliteImageUrl] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"course" | "satellite">("satellite");
  const [showDots, setShowDots] = useState(true);
  const [showEnvelope, setShowEnvelope] = useState(true);
  const [teeSetId, setTeeSetId] = useState(defaultControls.teeSetId ?? teeSets[0]?.id ?? "");
  const [holeNumber, setHoleNumber] = useState(
    defaultControls.holeNumber ?? holes[0]?.holeNumber ?? 1,
  );
  const [mode, setMode] = useState<ShotPatternMode>(defaultControls.mode);
  const [outlierMode, setOutlierMode] = useState<ShotPatternOutlierMode>(
    defaultControls.outlierMode,
  );
  const [targetPlacementOverride, setTargetPlacementOverride] = useState<{
    key: string;
    distanceYd: number;
    aimOffsetYd: number;
  } | null>(null);
  const [holeLengthOverride, setHoleLengthOverride] = useState<{
    key: string;
    yards: number;
  } | null>(null);
  const [clubSelection, setClubSelection] = useState<ClubSelection>({
    clubId: defaultControls.clubId,
    clubType: defaultControls.clubType,
  });
  const visibleHoles = holesByTeeSet[teeSetId] ?? holes;
  const selectedHoleNumber = visibleHoles.some((hole) => hole.holeNumber === holeNumber)
    ? holeNumber
    : (visibleHoles[0]?.holeNumber ?? holeNumber);
  const requestKey = `${teeSetId}:${selectedHoleNumber}:${clubSelection.clubId ?? ""}:${clubSelection.clubType}:${mode}:${outlierMode}`;
  const [response, setResponse] = useState<{
    key: string;
    data: ShotPatternApiData | null;
    error: string | null;
  }>({
    key: initialData ? requestKey : "",
    data: initialData,
    error: null,
  });
  const data = response.data;
  const error = response.key === requestKey ? response.error : null;
  const isLoading = response.key !== requestKey;
  const selectedHole = data?.hole ?? null;
  const renderedClubOptions = useMemo(
    () => (data?.clubOptions.length ? data.clubOptions : clubOptions),
    [clubOptions, data?.clubOptions],
  );
  const targetPlacementKey = `${teeSetId}:${selectedHoleNumber}`;
  const scorecardHoleYards = selectedHole?.yards ?? visibleHoles[0]?.yards ?? 300;
  const playingHoleYards =
    holeLengthOverride?.key === targetPlacementKey
      ? holeLengthOverride.yards
      : scorecardHoleYards;
  const isCustomPlayingLength = selectedHole ? playingHoleYards !== selectedHole.yards : false;
  const defaultTargetDistanceYd = useMemo(() => {
    const summary = data?.pattern.summary;
    const playNumber =
      mode === "carry"
        ? summary?.carryMedianYd
        : (summary?.totalMedianYd ?? summary?.carryMedianYd);

    return clampTargetDistance(
      playNumber ?? Math.round(playingHoleYards * 0.62),
      playingHoleYards,
    );
  }, [data?.pattern.summary, mode, playingHoleYards]);
  const targetDistanceYd = clampTargetDistance(
    targetPlacementOverride?.key === targetPlacementKey
      ? targetPlacementOverride.distanceYd
      : defaultTargetDistanceYd,
    playingHoleYards,
  );
  const targetAimOffsetYd =
    targetPlacementOverride?.key === targetPlacementKey ? targetPlacementOverride.aimOffsetYd : 0;
  const updateHoleLength = useCallback(
    (nextYards: number) => {
      setHoleLengthOverride({
        key: targetPlacementKey,
        yards: clampPlayingHoleLength(nextYards),
      });
    },
    [targetPlacementKey],
  );
  const updateTargetPlacement = useCallback(
    (nextPlacement: Partial<{ distanceYd: number; aimOffsetYd: number }>) => {
      const nextDistanceYd = clampTargetDistance(
        nextPlacement.distanceYd ?? targetDistanceYd,
        playingHoleYards,
      );
      const nextAimOffsetYd = clampTargetAimOffset(nextPlacement.aimOffsetYd ?? targetAimOffsetYd);

      setTargetPlacementOverride({
        key: targetPlacementKey,
        distanceYd: nextDistanceYd,
        aimOffsetYd: nextAimOffsetYd,
      });

      if (typeof nextPlacement.distanceYd === "number") {
        const targetClub = bestClubForTarget(renderedClubOptions, nextDistanceYd);

        if (targetClub && !clubSelectionMatchesOption(clubSelection, targetClub)) {
          setClubSelection({
            clubId: targetClub.clubId,
            clubType: targetClub.clubType,
          });
        }
      }
    },
    [
      clubSelection,
      playingHoleYards,
      renderedClubOptions,
      targetAimOffsetYd,
      targetDistanceYd,
      targetPlacementKey,
    ],
  );
  const displayProjection = useMemo<ProjectedShotPatternResult>(() => {
    if (!data) {
      return {
        points: [],
        summary: {
          medianLatLng: null,
          includedBounds: null,
        },
      };
    }

    if (!selectedHole) {
      return {
        points: data.projectedPoints,
        summary: data.projectedSummary,
      };
    }

    return projectShotPatternOntoHole({
      holeGeometry: selectedHole.geometry,
      holeYards: playingHoleYards,
      pattern: data.pattern,
      aimOffsetYd: targetAimOffsetYd,
    });
  }, [data, playingHoleYards, selectedHole, targetAimOffsetYd]);
  const courseFeatures = useMemo(() => data?.courseFeatures ?? [], [data?.courseFeatures]);
  const displayLandingSummary = useMemo(
    () =>
      data ? classifyProjectedPatternPoints(displayProjection.points, courseFeatures).summary : null,
    [data, displayProjection.points, courseFeatures],
  );
  const projectedPointSurfaces = useMemo(() => {
    if (courseFeatures.length === 0) {
      return new Map<string, TargetSurfaceStatus>();
    }

    return new Map(
      displayProjection.points.map((point) => [
        point.id,
        projectedLandingSurface(point.latLng, courseFeatures),
      ]),
    );
  }, [courseFeatures, displayProjection.points]);
  const targetLine = useMemo(
    () =>
      selectedHole && data
        ? buildShotPatternTargetLine({
            holeGeometry: selectedHole.geometry,
            holeYards: playingHoleYards,
            targetDistanceYd,
            aimOffsetYd: targetAimOffsetYd,
            points: data.pattern.points,
            features: data.courseFeatures,
          })
        : null,
    [data, playingHoleYards, selectedHole, targetAimOffsetYd, targetDistanceYd],
  );
  const selectedClubOption = useMemo(
    () => renderedClubOptions.find((option) => clubSelectionMatchesOption(clubSelection, option)),
    [clubSelection, renderedClubOptions],
  );
  const satelliteImageUrl = useMemo(() => {
    if (!selectedHole) {
      return null;
    }

    const boundsPoints = [
      ...selectedHole.geometry,
      ...displayProjection.points.map((point) => point.latLng),
      ...(targetLine
        ? [
            targetLine.centerlinePoint,
            targetLine.center,
            targetLine.leftEndpoint,
            targetLine.rightEndpoint,
          ]
        : []),
    ];

    return esriSatelliteExportUrl(localBounds(boundsPoints));
  }, [displayProjection.points, selectedHole, targetLine]);
  const fullShotYd = useMemo(
    () =>
      fullShotDistanceForMode({
        mode,
        option: selectedClubOption ?? null,
        pattern: data?.pattern ?? null,
      }),
    [data?.pattern, mode, selectedClubOption],
  );
  const targetSwingPercent =
    fullShotYd && fullShotYd > 0 ? Math.round((targetDistanceYd / fullShotYd) * 100) : null;
  const targetSwingLabel = targetSwingPercent === null ? "--" : `~${targetSwingPercent}%`;
  const targetMarkerDetail =
    targetSwingPercent === null
      ? formatAimOffset(targetAimOffsetYd)
      : `${targetSwingPercent}% · ${formatAimOffset(targetAimOffsetYd)}`;
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
        tileLayer.on("loading", () => {
          if (isMounted) setTileReady(false);
        });
        tileLayer.on("load", () => {
          if (isMounted) setTileReady(true);
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
      fitBoundsKeyRef.current = null;
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
    if (response.key === requestKey && response.data && !response.error) {
      return;
    }

    const abortController = new AbortController();
    const params = new URLSearchParams({
      courseId,
      teeSetId,
      holeNumber: String(selectedHoleNumber),
      mode,
      outlier: outlierMode,
      limit: "50",
    });

    if (clubSelection.clubId) {
      params.set("clubId", clubSelection.clubId);
    } else {
      params.set("clubType", clubSelection.clubType);
    }

    fetch(`/api/shot-pattern?${params.toString()}`, {
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Shot pattern request failed (${response.status})`);
        }

        return (await response.json()) as ShotPatternApiData;
      })
      .then((payload) => {
        setResponse({
          key: requestKey,
          data: payload,
          error: null,
        });
      })
      .catch((fetchError: unknown) => {
        if (!abortController.signal.aborted) {
          setResponse((current) => ({
            key: requestKey,
            data: current.data,
            error:
              fetchError instanceof Error ? fetchError.message : "Shot pattern failed to load.",
          }));
        }
      });

    return () => {
      abortController.abort();
    };
  }, [
    courseId,
    requestKey,
    response.data,
    response.error,
    response.key,
    teeSetId,
    selectedHoleNumber,
    mode,
    outlierMode,
    clubSelection,
  ]);

  useEffect(() => {
    if (!leaflet || !mapRef.current || !layerRef.current || !selectedHole) {
      return;
    }

    const L = leaflet;
    const layers = layerRef.current;
    layers.clearLayers();

    L.polyline(selectedHole.geometry, {
      color: "#f8fafc",
      weight: 9,
      opacity: 0.95,
    }).addTo(layers);
    L.polyline(selectedHole.geometry, {
      color: "#22c55e",
      weight: 4,
      opacity: 0.98,
    }).addTo(layers);

    const tee = selectedHole.geometry[0];
    const green = selectedHole.geometry[selectedHole.geometry.length - 1];

    if (tee) {
      L.circleMarker(tee, {
        radius: 8,
        color: "#111827",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(`Hole ${selectedHole.holeNumber} tee`)
        .addTo(layers);
    }

    if (green) {
      L.circleMarker(green, {
        radius: 9,
        color: "#16a34a",
        fillColor: "#dcfce7",
        fillOpacity: 0.95,
        weight: 2,
      })
        .bindTooltip(`Hole ${selectedHole.holeNumber} green`)
        .addTo(layers);
    }

    const includedPoints = displayProjection.points.filter((point) => point.included);
    const excludedPoints = displayProjection.points.filter((point) => !point.included);

    if (showEnvelope) {
      const hull = convexHull(includedPoints.map((point) => point.latLng));

      if (hull.length >= 3) {
        const hasMappedSurfaceColours = projectedPointSurfaces.size > 0;

        L.polygon(hull, {
          color: "#0f172a",
          fillColor: hasMappedSurfaceColours ? "#0f172a" : "#38bdf8",
          fillOpacity: hasMappedSurfaceColours ? 0.1 : 0.18,
          opacity: 0.72,
          weight: 2,
        }).addTo(layers);
      }
    }

    if (showDots) {
      for (const point of excludedPoints) {
        const surface = projectedPointSurfaces.get(point.id);

        L.circleMarker(point.latLng, {
          radius: 3,
          color: "#64748b",
          fillColor: surface ? targetSurfaceColor(surface) : "#94a3b8",
          fillOpacity: surface ? 0.2 : 0.18,
          opacity: surface ? 0.34 : 0.22,
          weight: 1,
        }).addTo(layers);
      }

      for (const point of includedPoints) {
        const surface = projectedPointSurfaces.get(point.id);

        L.circleMarker(point.latLng, {
          radius: 4,
          color: "#0f172a",
          fillColor: surface ? targetSurfaceColor(surface) : "#38bdf8",
          fillOpacity: surface ? 0.76 : 0.34,
          opacity: surface ? 0.86 : 0.44,
          weight: 1.5,
        })
          .bindTooltip(
            `${numberFormatter.format(point.distanceYd)} yd historic landing${surface ? ` · ${surface === "playable" ? "fairway/green" : "trouble"}` : ""}`,
          )
          .addTo(layers);
      }
    }

    if (targetLine) {
      if (tee && targetLine.aimOffsetYd !== 0) {
        const aimLabelPoint = interpolateLatLng(tee, targetLine.center, AIM_LINE_LABEL_RATIO);

        L.polyline([tee, targetLine.center], {
          color: "#020617",
          weight: 7,
          opacity: 0.74,
          dashArray: "12 9",
          lineCap: "round",
        }).addTo(layers);
        L.polyline([tee, targetLine.center], {
          color: "#facc15",
          weight: 3,
          opacity: 0.96,
          dashArray: "12 9",
          lineCap: "round",
        }).addTo(layers);
        L.marker(aimLabelPoint, {
          interactive: false,
          zIndexOffset: 1150,
          icon: L.divIcon({
            className: "",
            iconSize: [74, 26],
            iconAnchor: [37, 13],
            html: `<div class="whitespace-nowrap rounded-md border border-slate-950 bg-yellow-300 px-2 py-1 text-xs font-black text-slate-950 shadow">Aim ${formatAimOffset(targetLine.aimOffsetYd)}</div>`,
          }),
        }).addTo(layers);
      }

      if (targetLine.aimOffsetYd !== 0) {
        L.polyline([targetLine.centerlinePoint, targetLine.center], {
          color: "#facc15",
          weight: 3,
          opacity: 0.9,
          dashArray: "6 7",
        }).addTo(layers);
      }

      for (const segment of targetLine.segments) {
        L.polyline([segment.start, segment.end], {
          color: "#f8fafc",
          weight: 12,
          opacity: 0.92,
          lineCap: "butt",
        }).addTo(layers);
        L.polyline([segment.start, segment.end], {
          color: targetSurfaceColor(segment.surface),
          weight: 7,
          opacity: 0.96,
          lineCap: "butt",
        }).addTo(layers);
      }

      if (showDots && !targetLine.beyondCapability) {
        for (const point of targetLine.points.filter((point) => !point.included)) {
          L.circleMarker(point.latLng, {
            radius: 3,
            color: "#0f172a",
            fillColor: targetSurfaceColor(point.surface),
            fillOpacity: 0.24,
            opacity: 0.32,
            weight: 1,
          }).addTo(layers);
        }

        for (const point of targetLine.points.filter((point) => point.included)) {
          L.circleMarker(point.latLng, {
            radius: 5,
            color: "#0f172a",
            fillColor: targetSurfaceColor(point.surface),
            fillOpacity: 0.92,
            opacity: 0.96,
            weight: 1.5,
          })
            .bindTooltip(`${formatSide(point.sideYd)} at ${targetLine.targetDistanceYd} yd`)
            .addTo(layers);
        }
      }

      L.marker(targetLine.leftEndpoint, {
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: `<div class="rounded-md bg-white/95 px-2 py-1 text-xs font-bold text-slate-950 shadow">${targetLine.leftMissYd}L</div>`,
        }),
      }).addTo(layers);
      L.marker(targetLine.rightEndpoint, {
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: `<div class="rounded-md bg-white/95 px-2 py-1 text-xs font-bold text-slate-950 shadow">${targetLine.rightMissYd}R</div>`,
        }),
      }).addTo(layers);

      const targetMarker = L.marker(targetLine.center, {
        draggable: true,
        zIndexOffset: 1200,
        icon: L.divIcon({
          className: "",
          html: `<div class="grid min-w-24 place-items-center rounded-full border-2 border-slate-950 bg-yellow-300 px-3 py-1 text-sm font-black leading-tight text-slate-950 shadow-lg"><span>${targetLine.targetDistanceYd} yd</span><span class="text-[11px]">${targetMarkerDetail}</span></div>`,
        }),
      })
        .bindTooltip("Drag target distance and aim")
        .addTo(layers);

      targetMarker.on("dragend", () => {
        const markerPoint = targetMarker.getLatLng();
        const nextPlacement = nearestTargetPlacementOnGeometry(
          selectedHole.geometry,
          [markerPoint.lat, markerPoint.lng],
          playingHoleYards,
        );
        updateTargetPlacement({
          distanceYd: nextPlacement.distanceYd,
          aimOffsetYd: nextPlacement.aimOffsetYd,
        });
      });
    }

    const boundsPoints = [
      ...selectedHole.geometry,
      ...displayProjection.points.map((point) => point.latLng),
      ...(targetLine
        ? [
            targetLine.centerlinePoint,
            targetLine.center,
            targetLine.leftEndpoint,
            targetLine.rightEndpoint,
          ]
        : []),
    ];

    mapRef.current.invalidateSize();

    const fitBoundsKey = `${teeSetId}:${selectedHole.holeNumber}:${selectedHole.yards}`;

    if (fitBoundsKeyRef.current !== fitBoundsKey) {
      fitBoundsKeyRef.current = fitBoundsKey;
      mapRef.current.fitBounds(L.latLngBounds(boundsPoints).pad(0.28), {
        animate: false,
        maxZoom: 18,
      });
    }
  }, [
    displayProjection.points,
    leaflet,
    selectedHole,
    showDots,
    showEnvelope,
    targetLine,
    teeSetId,
    updateTargetPlacement,
    playingHoleYards,
    projectedPointSurfaces,
    targetMarkerDetail,
  ]);

  const clubSelectValue = clubSelection.clubId
    ? `club:${clubSelection.clubId}`
    : `type:${clubSelection.clubType}`;
  const targetSliderMaxYd = Math.max(
    80,
    Math.round(playingHoleYards * 1.15),
  );
  const targetLineIsPlayable =
    targetLine?.playablePercent !== null &&
    targetLine?.playablePercent !== undefined &&
    targetLine.playablePercent >= 65;
  const targetLineStatusLabel = targetLine?.beyondCapability
    ? "Out of range"
    : `${targetLine?.playablePercent ?? 0}% green`;
  const bestTargetClub = useMemo(() => {
    return bestClubForTarget(renderedClubOptions, targetDistanceYd);
  }, [renderedClubOptions, targetDistanceYd]);
  const bestTargetClubSelected =
    bestTargetClub &&
    (bestTargetClub.clubId
      ? clubSelection.clubId === bestTargetClub.clubId
      : !clubSelection.clubId && clubSelection.clubType === bestTargetClub.clubType);
  const showStaticSatellite =
    mapMode === "satellite" && Boolean(satelliteImageUrl) && !tileReady;
  const staticSatelliteReady =
    satelliteImageUrl !== null && loadedSatelliteImageUrl === satelliteImageUrl;
  const showStaticSatelliteOverlay = showStaticSatellite && staticSatelliteReady;
  const showVectorMap =
    mapMode === "course" || !tileReady || (mapMode === "satellite" && !staticSatelliteReady);
  const showSatelliteMap = mapMode === "satellite";

  return (
    <div className="relative h-[100svh] min-h-[100svh] overflow-hidden bg-slate-950 sm:grid sm:h-auto sm:min-h-0 sm:gap-4 sm:overflow-visible sm:bg-transparent xl:grid-cols-[minmax(320px,0.42fr)_minmax(0,1fr)]">
      <div className="apple-panel absolute inset-x-2 bottom-[calc(4.65rem+env(safe-area-inset-bottom))] z-[900] max-h-[38svh] space-y-2 overflow-y-auto rounded-xl bg-white/95 p-2 shadow-2xl backdrop-blur sm:static sm:z-auto sm:max-h-none sm:space-y-4 sm:overflow-visible sm:rounded-lg sm:bg-[var(--surface-soft)] sm:p-4 sm:shadow-none sm:backdrop-blur-none">
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-[#0B7A3B]">Shot Pattern Overlay</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal">{courseName}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Pick a hole and club to project your historical dispersion onto the mapped course.
          </p>
        </div>

        <label className="grid gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm">
          Tee set
          <select
            value={teeSetId}
            onChange={(event) => {
              const nextTeeSetId = event.target.value;
              const nextHoles = holesByTeeSet[nextTeeSetId] ?? [];
              setTeeSetId(nextTeeSetId);
              setHoleNumber(nextHoles[0]?.holeNumber ?? 1);
            }}
            className="h-9 w-full min-w-0 rounded-lg border border-input bg-white px-2 text-xs sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm"
          >
            {teeSets.map((teeSet) => (
              <option key={teeSet.id} value={teeSet.id}>
                {teeSet.name} · {teeSet.holeCount} mapped
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
          {visibleHoles.map((hole) => (
            <Button
              key={hole.holeNumber}
              type="button"
              variant={hole.holeNumber === selectedHoleNumber ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-9 rounded-lg text-sm font-semibold sm:h-11",
                hole.holeNumber === selectedHoleNumber && "bg-[#0B7A3B] text-white",
              )}
              onClick={() => setHoleNumber(hole.holeNumber)}
            >
              {hole.holeNumber}
            </Button>
          ))}
        </div>

        <label className="grid gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm">
          Playing length
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2">
            <input
              aria-label="Playing length yards"
              type="number"
              min={50}
              max={750}
              value={playingHoleYards}
              onChange={(event) => updateHoleLength(Number(event.target.value))}
              className="h-9 min-w-0 rounded-lg border border-input bg-white px-2 text-right text-sm font-semibold sm:h-11 sm:rounded-xl sm:px-3"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 rounded-lg px-3 sm:h-11 sm:rounded-xl"
              disabled={!isCustomPlayingLength}
              onClick={() => {
                setHoleLengthOverride(null);
              }}
            >
              Reset
            </Button>
          </div>
          <span className="hidden text-xs font-normal text-muted-foreground sm:block">
            {isCustomPlayingLength
              ? `Scorecard length is ${numberFormatter.format(selectedHole?.yards ?? scorecardHoleYards)} yd.`
              : "Uses the saved tee-to-hole scorecard length."}
          </span>
        </label>

        <label className="grid gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm">
          Club
          <select
            value={clubSelectValue}
            onChange={(event) => {
              const value = event.target.value;
              if (value.startsWith("club:")) {
                const clubId = value.slice("club:".length);
                const option = renderedClubOptions.find((item) => item.clubId === clubId);
                setClubSelection({ clubId, clubType: option?.clubType ?? "driver" });
              } else {
                setClubSelection({ clubId: null, clubType: value.slice("type:".length) });
              }
            }}
            className="h-9 w-full min-w-0 rounded-lg border border-input bg-white px-2 text-xs sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm"
          >
            {renderedClubOptions.map((option) => (
              <option
                key={`${option.clubId ?? "type"}-${option.clubType}`}
                value={option.clubId ? `club:${option.clubId}` : `type:${option.clubType}`}
              >
                {option.label} · {optionSampleLabel(option.sampleSize)}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm sm:rounded-xl sm:p-3">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div>
              <p className="text-sm font-semibold">Target line</p>
              <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
                Move distance and aim left or right to test where the club pattern crosses.
              </p>
            </div>
            <div
              className={cn(
                "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold sm:px-2.5 sm:py-1",
                targetLine?.beyondCapability
                  ? "bg-slate-100 text-slate-700"
                  : targetLineIsPlayable
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700",
              )}
            >
              {targetLineStatusLabel}
            </div>
          </div>
          <div className="mt-2 grid gap-1.5 sm:mt-3 sm:gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                aria-label="Target distance"
                type="range"
                min={20}
                max={targetSliderMaxYd}
                value={targetDistanceYd}
                onChange={(event) =>
                  updateTargetPlacement({ distanceYd: Number(event.target.value) })
                }
                className="min-w-0 flex-1 accent-[#0B7A3B]"
              />
              <input
                aria-label="Target distance yards"
                type="number"
                min={20}
                max={targetSliderMaxYd}
                value={targetDistanceYd}
                onChange={(event) =>
                  updateTargetPlacement({ distanceYd: Number(event.target.value) })
                }
                className="h-9 w-20 rounded-lg border border-input px-2 text-right text-sm font-semibold sm:h-10 sm:w-24"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                aria-label="Aim offset"
                type="range"
                min={-140}
                max={140}
                value={targetAimOffsetYd}
                onChange={(event) =>
                  updateTargetPlacement({ aimOffsetYd: Number(event.target.value) })
                }
                className="min-w-0 flex-1 accent-[#0B7A3B]"
              />
              <input
                aria-label="Aim offset yards"
                type="number"
                min={-140}
                max={140}
                value={targetAimOffsetYd}
                onChange={(event) =>
                  updateTargetPlacement({ aimOffsetYd: Number(event.target.value) })
                }
                className="h-9 w-20 rounded-lg border border-input px-2 text-right text-sm font-semibold sm:h-10 sm:w-24"
              />
            </div>
            <div className="hidden grid-cols-2 gap-2 text-sm sm:grid">
              <TargetMetric label="Target" value={`${targetDistanceYd} yd`} />
              <TargetMetric label="Aim" value={formatAimOffset(targetAimOffsetYd)} />
              <TargetMetric label="Swing" value={targetSwingLabel} />
              <TargetMetric
                label={mode === "carry" ? "Full carry" : "Full shot"}
                value={fullShotYd === null ? "--" : `${numberFormatter.format(fullShotYd)} yd`}
              />
              <TargetMetric label="Left miss" value={`${targetLine?.leftMissYd ?? "--"}L`} />
              <TargetMetric label="Right miss" value={`${targetLine?.rightMissYd ?? "--"}R`} />
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {targetLine?.beyondCapability
                ? `No line score: recent ${data?.pattern.clubLabel ?? "club"} max is ${numberFormatter.format(targetLine.capabilityDistanceYd ?? 0)} yd.`
                : targetLine?.surfaceMode === "mapped"
                  ? "Green means fairway or green from mapped or generated landing-zone polygons; water, bunkers, trees, rough and unknown are red."
                  : "Green uses the current course-line corridor until fairway polygons are mapped."}
            </p>
            {bestTargetClub ? (
              <Button
                type="button"
                size="sm"
                variant={bestTargetClubSelected ? "secondary" : "outline"}
                className="h-8 justify-between rounded-lg text-xs sm:h-9 sm:text-sm"
                onClick={() =>
                  setClubSelection({
                    clubId: bestTargetClub.clubId,
                    clubType: bestTargetClub.clubType,
                  })
                }
              >
                <span className="truncate">Best fit: {shortClubLabel(bestTargetClub.label)}</span>
                <span>{numberFormatter.format(bestTargetClub.playNumberYd ?? 0)} yd</span>
              </Button>
            ) : null}
          </div>
        </div>

        <SegmentedControl
          label="Distance"
          items={[
            { label: "Total", value: "total" },
            { label: "Carry", value: "carry" },
          ]}
          value={mode}
          onChange={(value) => setMode(value as ShotPatternMode)}
        />

        <SegmentedControl
          label="Filter"
          items={[
            { label: "Best 90%", value: "best90" },
            { label: "Best 80%", value: "best80" },
            { label: "All shots", value: "all" },
          ]}
          value={outlierMode}
          onChange={(value) => setOutlierMode(value as ShotPatternOutlierMode)}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={showDots ? "default" : "outline"}
            className={cn(showDots && "bg-[#0B7A3B] text-white")}
            onClick={() => setShowDots((current) => !current)}
          >
            Dots
          </Button>
          <Button
            type="button"
            variant={showEnvelope ? "default" : "outline"}
            className={cn(showEnvelope && "bg-[#0B7A3B] text-white")}
            onClick={() => setShowEnvelope((current) => !current)}
          >
            Envelope
          </Button>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 space-y-3">
        <div className="map-frame shot-pattern-mobile-map relative h-[100svh] min-h-[100svh] overflow-hidden sm:h-[72vh] sm:min-h-[420px] lg:min-h-[620px]">
          {showStaticSatellite && satelliteImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={satelliteImageUrl}
              alt=""
              className={cn(
                "absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-300",
                staticSatelliteReady ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => setLoadedSatelliteImageUrl(satelliteImageUrl)}
              onError={() => setLoadedSatelliteImageUrl(null)}
            />
          ) : null}
          <HoleVectorFallback
            hole={selectedHole}
            playingHoleYards={playingHoleYards}
            projectedPoints={displayProjection.points}
            medianLatLng={displayProjection.summary.medianLatLng}
            targetLine={targetLine}
            variant={showStaticSatelliteOverlay ? "overlay" : "course"}
            className={cn(
              showVectorMap || showStaticSatelliteOverlay ? "opacity-100" : "opacity-0",
              showStaticSatelliteOverlay && "pointer-events-none z-[12] bg-transparent",
            )}
            isLoading={isLoading}
            showSatelliteHint={mapMode === "satellite" && !tileReady && !staticSatelliteReady}
          />
          <div
            ref={setMapContainerRef}
            className={cn(
              "absolute inset-0 z-10 h-full w-full transition-opacity duration-300",
              showSatelliteMap ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            style={{ backgroundColor: "transparent" }}
          />
          <div className="absolute left-3 right-3 top-[calc(3.75rem+env(safe-area-inset-top))] z-20 flex flex-wrap items-start justify-between gap-2 sm:top-3">
            <div className="rounded-lg bg-white/92 px-3 py-2 text-sm font-semibold text-[#111827] shadow-sm backdrop-blur">
              {selectedHole ? (
                <span className="grid leading-tight">
                  <span>
                    Hole {selectedHole.holeNumber} · {numberFormatter.format(playingHoleYards)} yd
                    playing
                  </span>
                  {isCustomPlayingLength ? (
                    <span className="text-[11px] font-medium text-slate-600">
                      Scorecard {numberFormatter.format(selectedHole.yards)} yd
                    </span>
                  ) : null}
                </span>
              ) : (
                "Hole map"
              )}
            </div>
            <div className="flex w-fit rounded-lg border bg-white/92 p-1 shadow-sm backdrop-blur">
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
          {isLoading ? (
            <div className="absolute bottom-3 left-3 z-30 rounded-lg bg-black/60 px-3 py-2 text-xs text-white">
              Updating pattern...
            </div>
          ) : null}
        </div>

        {data ? (
          <ShotPatternSummaryDrawer
            pattern={data.pattern}
            landingSummary={displayLandingSummary ?? data.landingSummary}
            targetLine={targetLine}
          />
        ) : (
          <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-muted-foreground">
            Shot pattern data is loading.
          </div>
        )}
      </div>
    </div>
  );
}

function SegmentedControl({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 text-sm font-medium">
      {label}
      <div
        className="grid gap-1 rounded-xl border bg-white/92 p-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={value === item.value ? "default" : "ghost"}
            className={cn("h-9 rounded-lg", value === item.value && "bg-[#0B7A3B] text-white")}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function TargetMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2 ring-1 ring-slate-200">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function HoleVectorFallback({
  hole,
  playingHoleYards,
  projectedPoints,
  medianLatLng,
  targetLine,
  variant = "course",
  className,
  isLoading,
  showSatelliteHint,
}: {
  hole: ShotPatternApiData["hole"];
  playingHoleYards: number;
  projectedPoints: ProjectedShotPatternPoint[];
  medianLatLng: LatLngPoint | null;
  targetLine: ShotPatternTargetLine | null;
  variant?: "course" | "overlay";
  className?: string;
  isLoading: boolean;
  showSatelliteHint: boolean;
}) {
  if (!hole) {
    return (
      <div className={cn("absolute inset-0 z-0 grid place-items-center bg-[#101827]", className)}>
        <p className="max-w-sm text-center text-sm text-slate-300">
          {isLoading
            ? "Loading mapped hole and shot pattern data."
            : "This course needs mapped hole geometry before shot patterns can be shown."}
        </p>
      </div>
    );
  }

  const allPoints = [
    ...hole.geometry,
    ...projectedPoints.map((point) => point.latLng),
    ...(targetLine
      ? [
          targetLine.centerlinePoint,
          targetLine.center,
          targetLine.leftEndpoint,
          targetLine.rightEndpoint,
        ]
      : []),
  ];
  const bounds = localBounds(allPoints);
  const centerline = hole.geometry.map((point) => toSvgPoint(point, bounds));
  const isOverlay = variant === "overlay";

  return (
    <div
      className={cn(
        "absolute inset-0 z-0 transition-opacity duration-300",
        isOverlay ? "bg-transparent" : "bg-[#101827]",
        className,
      )}
    >
      <svg
        viewBox="0 0 900 560"
        className="h-full w-full"
        role="img"
        aria-label="Shot pattern course view"
      >
        {isOverlay ? null : <rect width="900" height="560" fill="#101827" />}
        {isOverlay ? null : (
          <>
            <polyline
              points={pointsAttr(centerline)}
              fill="none"
              stroke="#17331f"
              strokeWidth="96"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={pointsAttr(centerline)}
              fill="none"
              stroke="#2d6843"
              strokeWidth="76"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        <polyline
          points={pointsAttr(centerline)}
          fill="none"
          stroke="#f8fafc"
          strokeWidth={isOverlay ? "4" : "2"}
          strokeDasharray="10 12"
          strokeLinecap="round"
          opacity={isOverlay ? "0.82" : "1"}
        />
        {targetLine?.aimOffsetYd && hole.geometry[0] ? (
          <g>
            <line
              x1={toSvgPoint(hole.geometry[0], bounds).x}
              y1={toSvgPoint(hole.geometry[0], bounds).y}
              x2={toSvgPoint(targetLine.center, bounds).x}
              y2={toSvgPoint(targetLine.center, bounds).y}
              stroke="#020617"
              strokeWidth="9"
              strokeDasharray="16 12"
              strokeLinecap="round"
              opacity="0.74"
            />
            <line
              x1={toSvgPoint(hole.geometry[0], bounds).x}
              y1={toSvgPoint(hole.geometry[0], bounds).y}
              x2={toSvgPoint(targetLine.center, bounds).x}
              y2={toSvgPoint(targetLine.center, bounds).y}
              stroke="#facc15"
              strokeWidth="5"
              strokeDasharray="16 12"
              strokeLinecap="round"
            />
            <text
              x={
                toSvgPoint(
                  interpolateLatLng(hole.geometry[0], targetLine.center, AIM_LINE_LABEL_RATIO),
                  bounds,
                ).x
              }
              y={
                toSvgPoint(
                  interpolateLatLng(hole.geometry[0], targetLine.center, AIM_LINE_LABEL_RATIO),
                  bounds,
                ).y
              }
              fill="#020617"
              fontSize="18"
              fontWeight="900"
              paintOrder="stroke"
              stroke="#facc15"
              strokeWidth="8"
              strokeLinejoin="round"
            >
              Aim {formatAimOffset(targetLine.aimOffsetYd)}
            </text>
          </g>
        ) : null}
        {convexHull(projectedPoints.filter((point) => point.included).map((point) => point.latLng))
          .length >= 3 ? (
          <polygon
            points={pointsAttr(
              convexHull(
                projectedPoints.filter((point) => point.included).map((point) => point.latLng),
              ).map((point) => toSvgPoint(point, bounds)),
            )}
            fill="#38bdf8"
            fillOpacity="0.18"
            stroke="#e2e8f0"
            strokeWidth="2"
          />
        ) : null}
        {projectedPoints.map((point) => {
          const svgPoint = toSvgPoint(point.latLng, bounds);
          return (
            <circle
              key={point.id}
              cx={svgPoint.x}
              cy={svgPoint.y}
              r={point.included ? "7" : "4"}
              fill={point.included ? "#38bdf8" : "#94a3b8"}
              fillOpacity={point.included ? "0.9" : "0.35"}
              stroke="#0f172a"
              strokeWidth="1.5"
            />
          );
        })}
        {targetLine
          ? targetLine.segments.map((segment, index) => {
              const start = toSvgPoint(segment.start, bounds);
              const end = toSvgPoint(segment.end, bounds);

              return (
                <g key={`${segment.startSideYd}-${segment.endSideYd}-${index}`}>
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#f8fafc"
                    strokeWidth="16"
                    strokeLinecap="butt"
                  />
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={targetSurfaceColor(segment.surface)}
                    strokeWidth="10"
                    strokeLinecap="butt"
                  />
                </g>
              );
            })
          : null}
        {targetLine?.aimOffsetYd ? (
          <line
            x1={toSvgPoint(targetLine.centerlinePoint, bounds).x}
            y1={toSvgPoint(targetLine.centerlinePoint, bounds).y}
            x2={toSvgPoint(targetLine.center, bounds).x}
            y2={toSvgPoint(targetLine.center, bounds).y}
            stroke="#facc15"
            strokeWidth="5"
            strokeDasharray="10 9"
            strokeLinecap="round"
          />
        ) : null}
        {targetLine && !targetLine.beyondCapability
          ? targetLine.points.map((point) => {
              const svgPoint = toSvgPoint(point.latLng, bounds);

              return (
                <circle
                  key={`target-${point.id}`}
                  cx={svgPoint.x}
                  cy={svgPoint.y}
                  r={point.included ? "7" : "4"}
                  fill={targetSurfaceColor(point.surface)}
                  fillOpacity={point.included ? "0.92" : "0.32"}
                  stroke="#020617"
                  strokeWidth="1.5"
                />
              );
            })
          : null}
        {targetLine ? (
          <g>
            <circle
              cx={toSvgPoint(targetLine.center, bounds).x}
              cy={toSvgPoint(targetLine.center, bounds).y}
              r="14"
              fill="#facc15"
              stroke="#020617"
              strokeWidth="4"
            />
            <text
              x={toSvgPoint(targetLine.center, bounds).x + 16}
              y={toSvgPoint(targetLine.center, bounds).y - 16}
              fill="#f8fafc"
              fontSize="22"
              fontWeight="800"
            >
              {targetLine.targetDistanceYd} yd · {formatAimOffset(targetLine.aimOffsetYd)}
            </text>
          </g>
        ) : null}
        {medianLatLng ? (
          <circle
            cx={toSvgPoint(medianLatLng, bounds).x}
            cy={toSvgPoint(medianLatLng, bounds).y}
            r="12"
            fill="#facc15"
            stroke="#020617"
            strokeWidth="3"
          />
        ) : null}
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
        {isOverlay ? null : (
          <>
            <text x="30" y="44" fill="#f8fafc" fontSize="24" fontWeight="800">
              Hole {hole.holeNumber}
            </text>
            <text x="30" y="74" fill="#cbd5e1" fontSize="15">
              Par {hole.par} · {playingHoleYards} yd playing · {projectedPoints.length} pattern
              shots
            </text>
          </>
        )}
      </svg>
      {showSatelliteHint ? (
        <div className="absolute bottom-3 left-3 rounded-lg bg-black/55 px-3 py-2 text-xs text-white">
          Satellite tiles are still loading. Showing course view.
        </div>
      ) : null}
    </div>
  );
}

function localBounds(points: LatLngPoint[]) {
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

function esriSatelliteExportUrl(bounds: ReturnType<typeof localBounds>) {
  const params = new URLSearchParams({
    bbox: [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat].join(","),
    bboxSR: "4326",
    imageSR: "4326",
    size: "900,560",
    format: "jpg",
    f: "image",
  });

  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params.toString()}`;
}

function toSvgPoint(point: LatLngPoint, bounds: ReturnType<typeof localBounds>) {
  const width = bounds.maxLng - bounds.minLng || 1;
  const height = bounds.maxLat - bounds.minLat || 1;

  return {
    x: 64 + ((point[1] - bounds.minLng) / width) * 772,
    y: 64 + ((bounds.maxLat - point[0]) / height) * 432,
  };
}

function pointsAttr(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function convexHull(points: LatLngPoint[]) {
  if (points.length <= 3) {
    return points;
  }

  const sorted = [...points].sort((left, right) => left[1] - right[1] || left[0] - right[0]);
  const lower: LatLngPoint[] = [];
  const upper: LatLngPoint[] = [];

  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  for (const point of [...sorted].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

function cross(origin: LatLngPoint, left: LatLngPoint, right: LatLngPoint) {
  return (
    (left[1] - origin[1]) * (right[0] - origin[0]) - (left[0] - origin[0]) * (right[1] - origin[1])
  );
}

function interpolateLatLng(start: LatLngPoint, end: LatLngPoint, ratio: number): LatLngPoint {
  const safeRatio = Math.max(0, Math.min(1, ratio));

  return [start[0] + (end[0] - start[0]) * safeRatio, start[1] + (end[1] - start[1]) * safeRatio];
}

function formatSide(value: number) {
  if (value === 0) {
    return "0 yd";
  }

  return `${numberFormatter.format(Math.abs(value))}${value > 0 ? "R" : "L"}`;
}

function formatAimOffset(value: number) {
  if (value === 0) {
    return "Centre";
  }

  return `${numberFormatter.format(Math.abs(value))}${value > 0 ? "R" : "L"}`;
}

function targetSurfaceColor(surface: "playable" | "trouble" | "unavailable") {
  if (surface === "unavailable") {
    return "#94a3b8";
  }

  return surface === "playable" ? "#16a34a" : "#dc2626";
}

function projectedLandingSurface(
  point: LatLngPoint,
  features: CourseFeature[],
): Exclude<TargetSurfaceStatus, "unavailable"> {
  const lie = classifyLandingPoint(point, features);

  return lie === "fairway" || lie === "green" ? "playable" : "trouble";
}

function shortClubLabel(label: string) {
  return label.split(" · ")[0] ?? label;
}

function optionSampleLabel(sampleSize: number) {
  return sampleSize > 50 ? `last 50 of ${numberFormatter.format(sampleSize)}` : sampleSize;
}

function clampPlayingHoleLength(yards: number) {
  const safeYards = Number.isFinite(yards) ? yards : 0;

  return Math.round(Math.max(50, Math.min(750, safeYards)));
}

function fullShotDistanceForMode({
  mode,
  option,
  pattern,
}: {
  mode: ShotPatternMode;
  option: ShotPatternClubOption | null;
  pattern: ShotPatternResult | null;
}) {
  const summary = pattern?.summary ?? null;
  const stockPlayNumber = option?.playNumberYd;

  if (mode === "total" && typeof stockPlayNumber === "number" && stockPlayNumber > 0) {
    return Math.round(stockPlayNumber);
  }

  const patternDistance =
    mode === "carry"
      ? (summary?.carryMedianYd ?? summary?.distanceP50Yd)
      : (summary?.totalMedianYd ?? summary?.distanceP50Yd);

  if (typeof patternDistance === "number" && Number.isFinite(patternDistance) && patternDistance > 0) {
    return Math.round(patternDistance);
  }

  if (typeof stockPlayNumber === "number" && Number.isFinite(stockPlayNumber) && stockPlayNumber > 0) {
    return Math.round(stockPlayNumber);
  }

  return null;
}

function bestClubForTarget(options: ShotPatternClubOption[], targetDistanceYd: number) {
  return options
    .filter(
      (option) =>
        option.sampleSize >= 8 &&
        typeof option.playNumberYd === "number" &&
        Number.isFinite(option.playNumberYd),
    )
    .sort(
      (left, right) =>
        Math.abs((left.playNumberYd ?? 0) - targetDistanceYd) -
        Math.abs((right.playNumberYd ?? 0) - targetDistanceYd),
    )[0];
}

function clubSelectionMatchesOption(selection: ClubSelection, option: ShotPatternClubOption) {
  return option.clubId
    ? selection.clubId === option.clubId
    : !selection.clubId && selection.clubType === option.clubType;
}
