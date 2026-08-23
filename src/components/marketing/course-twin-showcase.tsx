"use client";

import Image from "next/image";
import { useEffect, useState, type ComponentType } from "react";

import { trackPlausibleEvent } from "@/lib/analytics";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import {
  CourseTwinStaticFallback,
  type CourseTwinFallbackMode,
} from "./course-twin/course-twin-static-fallback";
import { Reveal, useInViewOnce } from "./reveal";
import styles from "./cinematic.module.css";

type RuntimeCapability = {
  canLoad: boolean;
  fallbackMode: CourseTwinFallbackMode;
};

const initialCapability: RuntimeCapability = {
  canLoad: false,
  fallbackMode: "checking",
};

export function CourseTwinShowcase() {
  const { ref, isVisible } = useInViewOnce<HTMLElement>("280px 0px");
  const [Runtime, setRuntime] = useState<ComponentType | null>(null);
  const [capability, setCapability] = useState(initialCapability);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const connection = (navigator as Navigator & { connection?: unknown }).connection as
        | { saveData?: boolean; effectiveType?: string }
        | undefined;
      const lowPowerConnection =
        connection?.saveData ||
        connection?.effectiveType === "slow-2g" ||
        connection?.effectiveType === "2g";
      const compactViewport = window.matchMedia("(max-width: 767px)").matches;
      const canvas = document.createElement("canvas");
      const webglAvailable = Boolean(
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
      );

      if (reducedMotion) {
        setCapability({ canLoad: false, fallbackMode: "reduced-motion" });
      } else if (compactViewport) {
        setCapability({ canLoad: false, fallbackMode: "data-saving" });
      } else if (lowPowerConnection) {
        setCapability({ canLoad: false, fallbackMode: "data-saving" });
      } else if (!webglAvailable) {
        setCapability({ canLoad: false, fallbackMode: "unsupported" });
      } else {
        setCapability({ canLoad: true, fallbackMode: "approaching" });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isVisible || !capability.canLoad || Runtime) return;
    let mounted = true;
    void import("./course-twin-demo-runtime")
      .then((module) => {
        if (mounted) setRuntime(() => module.default);
      })
      .catch(() => {
        if (mounted) setCapability({ canLoad: false, fallbackMode: "runtime-error" });
      });
    return () => {
      mounted = false;
    };
  }, [Runtime, capability.canLoad, isVisible]);

  const fallbackMode: CourseTwinFallbackMode =
    isVisible && capability.canLoad ? "loading" : capability.fallbackMode;

  return (
    <section
      id="course-twin"
      ref={ref}
      className={styles.courseTwinSection}
      aria-labelledby="course-twin-title"
      data-scroll-pause="course-twin"
    >
      <div className={styles.courseTwinStage}>
        <Reveal className={styles.courseTwinCopy} from="left">
          <p className={styles.kicker}>Course Twin · Pilot</p>
          <h2 id="course-twin-title">
            <span data-scene-vars="establish">See the hole.</span>
            <span data-scene-vars="route">Then see the decision.</span>
          </h2>
          <p>
            Your trusted carry, intended target and common miss move from the range into one mapped
            hole plan.
          </p>
          <div className={styles.twinProof}>
            <span className={styles.heroProofMark} aria-hidden>
              ✓
            </span>
            <span>
              <strong>Evidence stays honest</strong>
              Measured shots, reconstructed terrain and modelled planning remain visibly separate.
            </span>
          </div>
          <ol className={styles.twinProgress} aria-label="Course Twin demonstration stages">
            <li data-scene-vars="establish">Read the hole</li>
            <li data-scene-vars="tee">Find the tee</li>
            <li data-scene-vars="hazards">Read trouble</li>
            <li data-scene-vars="target">Choose safe side</li>
            <li data-scene-vars="route">Plot the shot</li>
            <li data-scene-vars="twin">Open the twin</li>
          </ol>
        </Reveal>
        <div className={styles.twinStoryStage} data-scene-vars="establish">
          <div className={styles.twinPhoto}>
            <div className={styles.twinPhotoImage}>
              <Image
                src="/assets/landing/course-twin-hole.avif"
                alt="Elevated view from tee to green on a strategic British parkland golf hole"
                fill
                sizes="100vw"
                data-scene-progress
              />
            </div>
            <div className={styles.twinMorphGrid} aria-hidden data-scene-vars="twin">
              <span />
              <span />
              <span />
            </div>
            <svg
              className={styles.twinShotPlan}
              viewBox="0 0 100 100"
              aria-hidden
              data-scene-vars="twin"
            >
              <path
                d="M50 92 C50 71 49.5 48 51 37 C51.8 32 52.6 29 53 28"
                pathLength="1"
                data-scene-vars="route"
              />
              <ellipse cx="53" cy="28" rx="7.5" ry="4.3" data-scene-vars="target" />
              <circle cx="50" cy="92" r="1.2" data-scene-vars="tee" />
              <circle cx="72" cy="16" r="1.5" data-scene-vars="route" />
            </svg>
            <div className={styles.twinHazards} aria-hidden data-scene-vars="twin">
              <span data-scene-vars="hazards" />
              <span data-scene-vars="hazards" />
            </div>
            <div className={styles.twinPhotoLabels} aria-hidden data-scene-vars="twin">
              <span data-scene-vars="tee">Tee</span>
              <span data-scene-vars="target">Safe side</span>
              <span data-scene-vars="route">Green</span>
            </div>
            <div className={styles.twinPhotoCaption} data-scene-vars="twin">
              <span>01 · Real hole</span>
              <strong>Read the shape</strong>
            </div>
          </div>
          <div
            className={styles.courseTwinDemo}
            onClick={() => trackPlausibleEvent("Public Course Twin Demo Opened")}
            data-scene-vars="twin"
          >
            <div
              className={styles.twinCompactPreview}
              role="img"
              aria-label="Digital Course Twin showing a modelled three wood route, safe target and common miss"
            >
              <Image src="/assets/landing/course-twin-mobile.avif" alt="" fill sizes="100vw" />
              <span aria-hidden />
            </div>
            <div className={styles.twinDigitalCaption}>
              <span>02 · Course Twin</span>
              <strong>Plan the miss</strong>
            </div>
            <div className={`t-skel ${styles.courseTwinSwap} ${Runtime ? "is-revealed" : ""}`}>
              <div className="t-skel-skeleton" aria-hidden={Runtime ? true : undefined}>
                <CourseTwinDemoState mode={fallbackMode} />
              </div>
              <div className="t-skel-content">{Runtime ? <Runtime /> : null}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CourseTwinDemoState({ mode }: { mode: CourseTwinFallbackMode }) {
  if (mode === "checking" || mode === "loading") {
    return (
      <div
        className="grid min-h-[420px] content-end gap-3 bg-emerald-950 p-5"
        aria-label="Loading Course Twin demo"
      >
        <Skeleton className="h-6 w-40 bg-white/15" />
        <Skeleton className="h-10 w-72 max-w-full bg-white/15" />
        <Skeleton className="h-24 w-full bg-white/10" />
      </div>
    );
  }

  if (mode === "unsupported" || mode === "runtime-error") {
    return (
      <div className="grid gap-2 bg-emerald-950 p-2">
        <Alert className="border-white/20 bg-white text-foreground">
          <span
            className="grid size-4 place-items-center rounded-full border text-[0.6rem]"
            aria-hidden
          >
            ✓
          </span>
          <AlertTitle>Interactive Course Twin is unavailable</AlertTitle>
          <AlertDescription>
            The labelled static plan remains available; measured, reconstructed, and modelled data
            stay separate.
          </AlertDescription>
        </Alert>
        <CourseTwinStaticFallback mode={mode} />
      </div>
    );
  }

  return <CourseTwinStaticFallback mode={mode} />;
}
