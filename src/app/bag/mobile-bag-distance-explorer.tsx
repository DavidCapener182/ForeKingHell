"use client";
import { Component, lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Cuboid, RotateCcw } from "lucide-react";
import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import { mobileBagDistanceView, type MobileBagDistanceView } from "@/lib/mobile-bag-distance-view";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import styles from "./mobile-bag-distance.module.css";
const Scene = lazy(() => import("./mobile-bag-distance-scene"));
export function MobileBagDistanceExplorer({ clubs }: { clubs: QuickBagClub[] }) {
  const model = useMemo(() => mobileBagDistanceView(clubs), [clubs]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("2d");
  const [selected, setSelected] = useState(model.clubs[0]?.id ?? "");
  const [reset, setReset] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const fallback = useCallback(() => {
    setUnavailable(true);
    setMode("2d");
  }, []);
  const club = model.clubs.find((item) => item.id === selected) ?? model.clubs[0];
  if (!club) return null;
  function launch() {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    setMode(
      unavailable ||
        connection?.saveData ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "2d"
        : "3d",
    );
    setOpen(true);
  }
  return (
    <>
      <button className={styles.open} onClick={launch}>
        <span>
          <span className="mobile-type-headline">Explore your distances</span>
          <span className="mobile-type-footnote text-muted-foreground">
            Interactive carry comparison
          </span>
        </span>
        <Cuboid aria-hidden className="size-6" />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className={styles.sheet}>
          <DrawerHeader>
            <div className={styles.controls}>
              <DrawerTitle>Your distance view</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" className="min-h-11">
                  Done
                </Button>
              </DrawerClose>
            </div>
            <DrawerDescription>
              Trusted carry distances. Lanes separate clubs; they do not show shot direction or
              dispersion.
            </DrawerDescription>
          </DrawerHeader>
          <div className={styles.body}>
            <div className={styles.controls}>
              <MobileSegmentedControl
                ariaLabel="Distance view"
                value={mode}
                onValueChange={setMode}
                options={[
                  { value: "2d", label: "2D" },
                  { value: "3d", label: "3D", disabled: unavailable },
                ]}
              />
              <Button
                variant="ghost"
                className="min-h-11"
                onClick={() => setReset((value) => value + 1)}
                disabled={mode !== "3d"}
              >
                <RotateCcw aria-hidden className="size-4" />
                Reset view
              </Button>
            </div>
            <div className={styles.scene} data-vaul-no-drag data-bag-distance-scene>
              {mode === "3d" ? (
                <SceneErrorBoundary
                  onError={fallback}
                  fallback={<FlatView model={model} selected={club.id} onSelect={setSelected} />}
                >
                  <Suspense
                    fallback={
                      <p className="p-4" role="status">
                        Opening 3D…
                      </p>
                    }
                  >
                    <Scene
                      key={reset}
                      model={model}
                      selected={club.id}
                      onSelect={setSelected}
                      onUnavailable={fallback}
                    />
                  </Suspense>
                </SceneErrorBoundary>
              ) : (
                <FlatView model={model} selected={club.id} onSelect={setSelected} />
              )}
            </div>
            <p className="mobile-type-footnote text-muted-foreground">
              {unavailable
                ? "3D could not open. Your distances are available in 2D."
                : mode === "3d"
                  ? "Drag to rotate · pinch to zoom · tap a club marker"
                  : "Tap a marker or choose a club below."}
            </p>
            <label className={styles.select}>
              <span className="mobile-type-footnote text-muted-foreground">Club</span>
              <select
                className={styles.clubSelect}
                value={club.id}
                onChange={(event) => setSelected(event.target.value)}
              >
                {model.clubs.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                    {item.equipmentLabel ? ` · ${item.equipmentLabel}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.readout} aria-live="polite">
              <p className={styles.carry}>
                {Math.round(club.carry)} <span>yd carry</span>
              </p>
              <Link className="flex min-h-11 items-center text-primary" href={`/bag/${club.id}`}>
                Club detail
              </Link>
            </div>
            <p className="mobile-type-footnote text-muted-foreground">
              {club.sampleSize} trusted shots
              {club.lowYd != null && club.highYd != null
                ? ` · ${Math.round(club.lowYd)}–${Math.round(club.highYd)} yd playable range`
                : ""}
              . Touch shots stay in your club detail.
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
function FlatView({
  model,
  selected,
  onSelect,
}: {
  model: MobileBagDistanceView;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <svg viewBox="0 0 360 280" role="img" aria-label="Carry distance comparison, 50 yard grid">
      {Array.from({ length: model.limit / 50 }, (_, i) => {
        const yards = (i + 1) * 50;
        const y = 255 - (yards / model.limit) * 225;
        return (
          <g key={yards}>
            <line x1="40" x2="340" y1={y} y2={y} stroke="#5b8d76" strokeWidth="0.6" />
            <text x="8" y={y + 4} fill="#c6ded0" fontSize="10">
              {yards}
            </text>
          </g>
        );
      })}
      {model.clubs.map((club) => {
        const x = 190 + club.lane * 3.8,
          y = 255 - club.distance * 2.25,
          active = club.id === selected;
        return (
          <g key={club.id} onClick={() => onSelect(club.id)}>
            <line
              x1={x}
              x2={x}
              y1="255"
              y2={y}
              stroke={active ? "#e5ff8d" : "#80b99c"}
              strokeWidth={active ? 3 : 1}
            />
            <circle cx={x} cy={y} r={active ? 8 : 5} fill={active ? "#e5ff8d" : "#a4d6bc"} />
            <circle cx={x} cy={y} r="22" fill="transparent" />
          </g>
        );
      })}
      <text x="10" y="274" fill="#c6ded0" fontSize="10">
        yd
      </text>
    </svg>
  );
}
class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
