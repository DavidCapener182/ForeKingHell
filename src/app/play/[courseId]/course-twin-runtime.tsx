"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import type { CourseTwinManifest, CourseTwinReplayDocument } from "@/lib/course-twin-contract";
import {
  browserCourseTwinDeviceSignals,
  courseTwinRenderQuality,
  type CourseTwinRenderQuality,
} from "@/lib/course-twin-performance";
import { Button } from "@/components/ui/button";

import mobileStyles from "./course-twin-mobile.module.css";
import { CourseTwinMobileOverhead } from "./course-twin-mobile-overhead";

const CourseTwinScene = dynamic(
  () => import("./course-twin-scene").then((module) => module.CourseTwinScene),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[560px] place-items-center bg-[#07150e] text-sm text-emerald-100">
        Preparing the Course Twin renderer…
      </div>
    ),
  },
);

export function CourseTwinRuntime({
  manifest,
  replay,
  readOnly = false,
  tournamentId,
  tournamentRoundNumber,
  initialMode,
  initialHoleNumber,
}: {
  manifest: CourseTwinManifest;
  replay: CourseTwinReplayDocument | null;
  readOnly?: boolean;
  tournamentId?: string | null;
  tournamentRoundNumber?: number | null;
  initialMode?: "strategy" | "replay";
  initialHoleNumber?: number;
}) {
  const detectedRenderQuality = useSyncExternalStore(
    subscribeToStaticDeviceSignals,
    readBrowserRenderQuality,
    readServerRenderQuality,
  );
  const [renderQualityOverride, setRenderQualityOverride] =
    useState<CourseTwinRenderQuality | null>(null);
  const renderQuality = renderQualityOverride ?? detectedRenderQuality;
  const compact = useSyncExternalStore(subscribeCompactViewport, readCompactViewport, () => false);

  if (renderQuality === "fallback") {
    if (compact)
      return (
        <CourseTwinMobileOverhead
          manifest={manifest}
          replay={replay}
          readOnly={readOnly}
          initialMode={initialMode}
          initialHoleNumber={initialHoleNumber}
          onEnable3d={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("quality", "balanced");
            window.location.assign(url);
          }}
        />
      );
    return (
      <CourseTwinLowPowerFallback
        manifest={manifest}
        onEnable3d={() => setRenderQualityOverride("balanced")}
      />
    );
  }

  return (
    <CourseTwinScene
      manifest={manifest}
      replay={replay}
      readOnly={readOnly}
      tournamentId={tournamentId}
      tournamentRoundNumber={tournamentRoundNumber}
      initialMode={initialMode}
      initialHoleNumber={initialHoleNumber}
      renderQuality={renderQuality}
    />
  );
}

function subscribeCompactViewport(listener: () => void) {
  const media = window.matchMedia("(max-width: 1023px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
function readCompactViewport() {
  return window.matchMedia("(max-width: 1023px)").matches;
}

function subscribeToStaticDeviceSignals() {
  return () => {};
}

function readBrowserRenderQuality(): CourseTwinRenderQuality {
  return courseTwinRenderQuality(browserCourseTwinDeviceSignals());
}

function readServerRenderQuality(): CourseTwinRenderQuality {
  // Do not request the 3D chunk before the browser can choose its quality tier.
  return "fallback";
}

function CourseTwinLowPowerFallback({
  manifest,
  onEnable3d,
}: {
  manifest: CourseTwinManifest;
  onEnable3d: () => void;
}) {
  const bounds = manifest.terrain.heightmap?.localBounds ?? manifest.bounds;
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxZ - bounds.minZ);
  const project = ([x, , z]: [number, number, number]) =>
    `${((x - bounds.minX) / width) * 1000},${((z - bounds.minZ) / height) * 700}`;

  return (
    <section
      data-course-twin-low-power-fallback
      aria-labelledby="course-twin-fallback-title"
      className={`${mobileStyles.fallback} grid content-start gap-5 bg-[#07150e] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white lg:h-auto lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-6`}
    >
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#10271a]">
        <div className="border-b border-white/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">
            2D Course Twin · low-power mode
          </p>
          <h1 id="course-twin-fallback-title" className="mt-1 text-2xl font-bold">
            {manifest.course.name}
          </h1>
          <p className="mt-1 text-sm text-emerald-50/70">
            The mapped hole plan remains available without loading the animated 3D renderer.
          </p>
        </div>
        <svg
          viewBox="0 0 1000 700"
          role="img"
          aria-label={`Overhead course plan showing ${manifest.holes.length} mapped holes`}
          className="aspect-[10/7] w-full bg-[#173b25]"
        >
          <rect width="1000" height="700" fill="#173b25" />
          {manifest.holes.map((hole) => (
            <g key={hole.holeNumber}>
              <polyline
                points={hole.centerline.map(project).join(" ")}
                fill="none"
                stroke="#b9e59f"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.88"
              />
              <circle
                cx={Number(project(hole.green).split(",")[0])}
                cy={Number(project(hole.green).split(",")[1])}
                r="10"
                fill="#e7ff6a"
              />
            </g>
          ))}
        </svg>
      </div>
      <aside className="grid content-start gap-4 rounded-2xl border border-white/15 bg-white/5 p-4">
        <div>
          <h2 className="font-semibold">Accessible hole plan</h2>
          <p className="mt-1 text-sm text-emerald-50/70">
            Hole, par and measured distance remain readable in this mode.
          </p>
        </div>
        <ol className="grid max-h-[48dvh] gap-2 overflow-y-auto" aria-label="Course holes">
          {manifest.holes.map((hole) => (
            <li
              key={hole.holeNumber}
              className="flex min-h-11 items-center justify-between rounded-xl border border-white/10 px-3 py-2"
            >
              <span className="font-semibold">Hole {hole.holeNumber}</span>
              <span className="text-sm text-emerald-50/70">
                Par {hole.par} · {hole.yards} yd
              </span>
            </li>
          ))}
        </ol>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <Button asChild className="min-h-11">
            <Link href={`/courses/strategy?courseId=${encodeURIComponent(manifest.course.id)}`}>
              Open Strategy map
            </Link>
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={onEnable3d}>
            Try balanced 3D
          </Button>
        </div>
      </aside>
    </section>
  );
}
