"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type * as Leaflet from "leaflet";
import { ChevronDown, Crosshair, MapPinned, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type EditableCourseHole = {
  id: string;
  holeNumber: number;
  par: number;
  strokeIndex: number | null;
  yards: number;
  teeLat: number;
  teeLng: number;
  greenLat: number;
  greenLng: number;
};

type DraftHole = {
  holeNumber: number;
  par: string;
  yards: string;
  strokeIndex: string;
  teeLat: string;
  teeLng: string;
  greenLat: string;
  greenLng: string;
};

type CourseHoleMapEditorProps = {
  courseId: string;
  teeSetId: string;
  teeSetName: string;
  holes: EditableCourseHole[];
  holeCount: number;
  saveHoleAction: (formData: FormData) => void | Promise<void>;
};

const DEFAULT_CENTER: [number, number] = [53.475, -2.97];
const coordinateFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 6,
});

export function CourseHoleMapEditor({
  courseId,
  teeSetId,
  teeSetName,
  holes,
  holeCount,
  saveHoleAction,
}: CourseHoleMapEditorProps) {
  const [mapContainerNode, setMapContainerNode] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const [leaflet, setLeaflet] = useState<typeof Leaflet | null>(null);
  const [selectedHoleNumber, setSelectedHoleNumber] = useState(holes[0]?.holeNumber ?? 1);
  const [placementTarget, setPlacementTarget] = useState<"tee" | "green">("tee");
  const [controlsOpen, setControlsOpen] = useState(false);
  const controlsId = useId();
  const placementTargetRef = useRef<"tee" | "green">("tee");
  const selectedHole = holes.find((hole) => hole.holeNumber === selectedHoleNumber) ?? null;
  const [draft, setDraft] = useState<DraftHole>(() =>
    draftFromHole(selectedHoleNumber, selectedHole),
  );
  const holeNumbers = useMemo(
    () => Array.from({ length: holeCount }, (_, index) => index + 1),
    [holeCount],
  );
  const setMapContainerRef = useCallback((node: HTMLDivElement | null) => {
    setMapContainerNode(node);
  }, []);

  useEffect(() => {
    placementTargetRef.current = placementTarget;
  }, [placementTarget]);

  useEffect(() => {
    let isMounted = true;

    async function setupMap() {
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
      const center = mapCenter(holes) ?? DEFAULT_CENTER;

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.scale({ imperial: true, metric: false, position: "bottomleft" }).addTo(map);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 20,
          attribution:
            "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        },
      ).addTo(map);
      const layers = L.layerGroup().addTo(map);

      map.setView(center, holes.length > 0 ? 16 : 13);
      map.on("click", (event) => {
        const nextLat = roundCoordinate(event.latlng.lat);
        const nextLng = roundCoordinate(event.latlng.lng);

        const target = placementTargetRef.current;

        setDraft((current) => ({
          ...current,
          [`${target}Lat`]: String(nextLat),
          [`${target}Lng`]: String(nextLng),
        }));
        setPlacementTarget((current) => (current === "tee" ? "green" : "tee"));
      });

      mapRef.current = map;
      layerRef.current = layers;
      setLeaflet(L);
    }

    void setupMap();

    return () => {
      isMounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [holes, mapContainerNode]);

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

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapContainerNode]);

  useEffect(() => {
    if (!leaflet || !mapRef.current || !layerRef.current) {
      return;
    }

    const L = leaflet;
    const layers = layerRef.current;
    layers.clearLayers();

    for (const hole of holes) {
      const isSelected = hole.holeNumber === selectedHoleNumber;
      const geometry: Array<[number, number]> = [
        [hole.teeLat, hole.teeLng],
        [hole.greenLat, hole.greenLng],
      ];

      L.polyline(geometry, {
        color: isSelected ? "#f8fafc" : "#ffffff",
        opacity: isSelected ? 0.92 : 0.34,
        weight: isSelected ? 8 : 4,
      }).addTo(layers);
      L.polyline(geometry, {
        color: isSelected ? "#38bdf8" : "#22c55e",
        opacity: isSelected ? 1 : 0.56,
        weight: isSelected ? 4 : 2,
      }).addTo(layers);
      L.circleMarker([hole.teeLat, hole.teeLng], {
        radius: isSelected ? 7 : 5,
        color: "#111827",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2,
      }).addTo(layers);
      L.circleMarker([hole.greenLat, hole.greenLng], {
        radius: isSelected ? 8 : 5,
        color: "#16a34a",
        fillColor: "#dcfce7",
        fillOpacity: 0.95,
        weight: 2,
      }).addTo(layers);
    }

    const draftTee = parseLatLng(draft.teeLat, draft.teeLng);
    const draftGreen = parseLatLng(draft.greenLat, draft.greenLng);

    if (draftTee) {
      L.circleMarker(draftTee, {
        radius: 8,
        color: "#020617",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 3,
      })
        .bindTooltip(`Hole ${selectedHoleNumber} tee draft`)
        .addTo(layers);
    }

    if (draftGreen) {
      L.circleMarker(draftGreen, {
        radius: 9,
        color: "#22c55e",
        fillColor: "#dcfce7",
        fillOpacity: 1,
        weight: 3,
      })
        .bindTooltip(`Hole ${selectedHoleNumber} green draft`)
        .addTo(layers);
    }

    if (draftTee && draftGreen) {
      L.polyline([draftTee, draftGreen], {
        color: "#38bdf8",
        opacity: 1,
        weight: 5,
        dashArray: "8 8",
      }).addTo(layers);
    }
  }, [draft, holes, leaflet, selectedHoleNumber]);

  function focusSelectedHole() {
    if (!leaflet || !mapRef.current) {
      return;
    }

    const draftTee = parseLatLng(draft.teeLat, draft.teeLng);
    const draftGreen = parseLatLng(draft.greenLat, draft.greenLng);
    const boundsPoints = [draftTee, draftGreen].filter((point): point is [number, number] =>
      Boolean(point),
    );

    if (boundsPoints.length === 1) {
      mapRef.current.setView(boundsPoints[0], 18);
    } else if (boundsPoints.length === 2) {
      mapRef.current.fitBounds(leaflet.latLngBounds(boundsPoints), {
        padding: [60, 60],
        maxZoom: 18,
      });
    }
  }

  return (
    <div className="grid gap-4" data-selected-hole={selectedHoleNumber}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="secondary">{teeSetName}</Badge>
          <h3 className="mt-2 text-xl font-semibold tracking-normal text-foreground">
            Select a hole, then place its points
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            The map stays primary. Detailed values and save controls open underneath on mobile.
          </p>
        </div>
        <MapPinned className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1" aria-label="Choose a hole to edit">
        <div className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-9">
          {holeNumbers.map((holeNumber) => (
            <Button
              key={holeNumber}
              type="button"
              variant={selectedHoleNumber === holeNumber ? "default" : "outline"}
              aria-pressed={selectedHoleNumber === holeNumber}
              aria-label={`Edit hole ${holeNumber}`}
              className="size-11 shrink-0 rounded-lg p-0"
              onClick={() => selectHole(holeNumber)}
            >
              {holeNumber}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)] lg:items-start">
        <div className="map-frame relative order-1 lg:order-2">
          <div
            ref={setMapContainerRef}
            className="h-[56dvh] min-h-[360px] max-h-[560px] w-full lg:h-[620px] lg:min-h-[460px] lg:max-h-none"
          />
          <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-background/92 px-3 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur-md">
            Hole {selectedHoleNumber} · place {placementTarget}
          </div>
        </div>

        <div className="order-2 lg:order-1">
          <Button
            type="button"
            variant="outline"
            aria-expanded={controlsOpen}
            aria-controls={controlsId}
            onClick={() => setControlsOpen((open) => !open)}
            className="focus-aaa flex h-auto min-h-14 w-full items-center justify-between gap-3 px-4 py-2.5 text-left lg:hidden"
          >
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-foreground">
                Hole {selectedHoleNumber} controls
              </span>
              <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">
                {selectedHole ? `${selectedHole.yards} yd · mapped` : "Add par, yardage and points"}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                controlsOpen && "rotate-180",
              )}
              aria-hidden
            />
          </Button>

          <div
            id={controlsId}
            className={cn("apple-panel p-4", !controlsOpen && "hidden", "lg:block")}
          >
            <div className="hidden items-start justify-between gap-3 lg:flex">
              <div>
                <h3 className="text-xl font-semibold tracking-normal">Hole controls</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Choose tee or green, click the satellite map, then save both points.
                </p>
              </div>
              <MapPinned className="size-5 text-primary" aria-hidden />
            </div>

            <div className="grid grid-cols-2 gap-2 lg:mt-4">
              <Button
                type="button"
                variant={placementTarget === "tee" ? "default" : "outline"}
                aria-pressed={placementTarget === "tee"}
                className="min-h-11"
                onClick={() => setPlacementTarget("tee")}
              >
                Tee point
              </Button>
              <Button
                type="button"
                variant={placementTarget === "green" ? "default" : "outline"}
                aria-pressed={placementTarget === "green"}
                className="min-h-11"
                onClick={() => setPlacementTarget("green")}
              >
                Green point
              </Button>
            </div>

            <form action={saveHoleAction} className="mt-4 grid gap-3">
              <input type="hidden" name="courseId" value={courseId} />
              <input type="hidden" name="teeSetId" value={teeSetId} />
              <input type="hidden" name="holeNumber" value={selectedHoleNumber} />

              <div className="grid grid-cols-3 gap-2">
                <Field
                  label="Par"
                  name="par"
                  value={draft.par}
                  onChange={setDraftValue("par")}
                  type="number"
                  min={1}
                  required
                />
                <Field
                  label="Yards"
                  name="yards"
                  value={draft.yards}
                  onChange={setDraftValue("yards")}
                  type="number"
                  min={1}
                  required
                />
                <Field
                  label="SI"
                  name="strokeIndex"
                  value={draft.strokeIndex}
                  onChange={setDraftValue("strokeIndex")}
                  type="number"
                  min={1}
                  max={18}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Field
                  label="Tee latitude"
                  name="teeLat"
                  value={draft.teeLat}
                  onChange={setDraftValue("teeLat")}
                  type="number"
                  step="0.000001"
                  required
                />
                <Field
                  label="Tee longitude"
                  name="teeLng"
                  value={draft.teeLng}
                  onChange={setDraftValue("teeLng")}
                  type="number"
                  step="0.000001"
                  required
                />
                <Field
                  label="Green latitude"
                  name="greenLat"
                  value={draft.greenLat}
                  onChange={setDraftValue("greenLat")}
                  type="number"
                  step="0.000001"
                  required
                />
                <Field
                  label="Green longitude"
                  name="greenLng"
                  value={draft.greenLng}
                  onChange={setDraftValue("greenLng")}
                  type="number"
                  step="0.000001"
                  required
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 bg-background"
                  onClick={focusSelectedHole}
                >
                  <Crosshair className="size-4" aria-hidden />
                  Focus hole
                </Button>
                <Button type="submit" className="min-h-11 flex-1">
                  <Save className="size-4" aria-hidden />
                  Save geometry
                </Button>
              </div>
            </form>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Current draft: tee {formatCoordinatePair(draft.teeLat, draft.teeLng)} / green{" "}
              {formatCoordinatePair(draft.greenLat, draft.greenLng)}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  function setDraftValue(key: keyof DraftHole) {
    return (value: string) => {
      setDraft((current) => ({ ...current, [key]: value }));
    };
  }

  function selectHole(holeNumber: number) {
    const nextHole = holes.find((hole) => hole.holeNumber === holeNumber) ?? null;
    setSelectedHoleNumber(holeNumber);
    setDraft(draftFromHole(holeNumber, nextHole));
    setPlacementTarget("tee");
  }
}

function Field({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl bg-background text-sm text-foreground"
      />
    </label>
  );
}

function draftFromHole(holeNumber: number, hole: EditableCourseHole | null): DraftHole {
  return {
    holeNumber,
    par: hole?.par ? String(hole.par) : "4",
    yards: hole?.yards ? String(hole.yards) : "",
    strokeIndex: hole?.strokeIndex ? String(hole.strokeIndex) : "",
    teeLat: hole ? String(hole.teeLat) : "",
    teeLng: hole ? String(hole.teeLng) : "",
    greenLat: hole ? String(hole.greenLat) : "",
    greenLng: hole ? String(hole.greenLng) : "",
  };
}

function mapCenter(holes: EditableCourseHole[]) {
  if (holes.length === 0) {
    return null;
  }

  const coordinates = holes.flatMap((hole) => [
    [hole.teeLat, hole.teeLng] as [number, number],
    [hole.greenLat, hole.greenLng] as [number, number],
  ]);

  return [
    coordinates.reduce((total, [lat]) => total + lat, 0) / coordinates.length,
    coordinates.reduce((total, [, lng]) => total + lng, 0) / coordinates.length,
  ] as [number, number];
}

function parseLatLng(lat: string, lng: string): [number, number] | null {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return null;
  }

  return [parsedLat, parsedLng];
}

function roundCoordinate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function formatCoordinatePair(lat: string, lng: string) {
  const pair = parseLatLng(lat, lng);

  if (!pair) {
    return "--";
  }

  return `${coordinateFormatter.format(pair[0])}, ${coordinateFormatter.format(pair[1])}`;
}
