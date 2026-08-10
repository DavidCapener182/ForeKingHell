"use client";

import { Canvas } from "@react-three/fiber";
import { Component, useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import * as THREE from "three";

import { SHOT_PLANS } from "./course-twin/course-twin-data";
import { CourseTwinHud } from "./course-twin/course-twin-hud";
import { CourseTwinScene } from "./course-twin/course-twin-scene";
import { CourseTwinStaticFallback } from "./course-twin/course-twin-static-fallback";
import type { CourseTwinQuality, MarketingCourseTwinClub } from "./course-twin/course-twin-types";
import styles from "./course-twin/course-twin.module.css";

const compactQuery = "(max-width: 767px), (max-height: 500px) and (pointer: coarse)";
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMedia(query: string, onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readMedia(query: string) {
  return window.matchMedia(query).matches;
}

function useCourseTwinQuality(): CourseTwinQuality {
  const compact = useSyncExternalStore(
    (onChange) => subscribeToMedia(compactQuery, onChange),
    () => readMedia(compactQuery),
    () => false,
  );
  return compact ? "compact" : "full";
}

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => subscribeToMedia(reducedMotionQuery, onChange),
    () => readMedia(reducedMotionQuery),
    () => false,
  );
}

export default function CourseTwinDemoRuntime() {
  return (
    <CourseTwinRuntimeBoundary>
      <CourseTwinInteractiveRuntime />
    </CourseTwinRuntimeBoundary>
  );
}

function CourseTwinInteractiveRuntime() {
  const quality = useCourseTwinQuality();
  const reducedMotion = useReducedMotion();
  const [club, setClub] = useState<MarketingCourseTwinClub>("three-wood");
  const [replayToken, setReplayToken] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [status, setStatus] = useState("3 Wood modelled plan ready.");
  const plan = SHOT_PLANS[club];

  const handleUnavailable = useCallback(() => setUnavailable(true), []);
  const handleClubChange = useCallback((nextClub: MarketingCourseTwinClub) => {
    const nextPlan = SHOT_PLANS[nextClub];
    setClub(nextClub);
    setReplayToken((current) => current + 1);
    setStatus(
      `${nextPlan.label} modelled plan selected. Expected carry ${nextPlan.expectedCarry}; ${nextPlan.targetLabel} target.`,
    );
  }, []);
  const handleReplay = useCallback(() => {
    setReplayToken((current) => current + 1);
    setStatus(`${plan.label} shot plan replayed toward ${plan.targetLabel}.`);
  }, [plan]);

  if (unavailable) return <CourseTwinStaticFallback mode="unsupported" />;

  return (
    <div
      className={styles.runtimeShell}
      data-course-twin-runtime
      data-quality={quality}
      aria-label="Interactive Course Twin shot planner"
      aria-describedby="course-twin-plan-description"
    >
      <div className={styles.scenePanel}>
        <Canvas
          className={styles.sceneCanvas}
          aria-hidden="true"
          frameloop="demand"
          dpr={quality === "compact" ? 1 : [1, 1.5]}
          camera={{ fov: 40, near: 1, far: 210, position: [45, 65, 82] }}
          gl={{
            alpha: false,
            antialias: quality === "full",
            depth: true,
            powerPreference: "high-performance",
            preserveDrawingBuffer: false,
          }}
          fallback={
            <div className={styles.canvasFallback}>
              The interactive course view is unavailable on this device.
            </div>
          }
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.16;
          }}
        >
          <CourseTwinScene
            plan={plan}
            replayToken={replayToken}
            reducedMotion={reducedMotion}
            quality={quality}
            onUnavailable={handleUnavailable}
          />
        </Canvas>
        <div className={styles.sceneBadges} aria-hidden>
          <span>Reconstructed terrain</span>
          <span>{plan.label} · modelled plan</span>
        </div>
        <div className={styles.sceneLegend} aria-hidden>
          <span data-kind="target">Safe target</span>
          <span data-kind="miss">Common miss</span>
        </div>
      </div>

      <CourseTwinHud
        club={club}
        plan={plan}
        status={status}
        onClubChange={handleClubChange}
        onReplay={handleReplay}
      />
    </div>
  );
}

class CourseTwinRuntimeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // The deliberate premium fallback below keeps the plan and evidence labels available.
  }

  render() {
    if (this.state.failed) return <CourseTwinStaticFallback mode="runtime-error" />;
    return this.props.children;
  }
}
