"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";

import { trackPlausibleEvent } from "@/lib/analytics";

import {
  CourseTwinStaticFallback,
  type CourseTwinFallbackMode,
} from "./course-twin/course-twin-static-fallback";
import { useInViewOnce } from "./reveal";
import { ScrollZoomFrame } from "./scroll-zoom-frame";
import styles from "./marketing.module.css";

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
      const canvas = document.createElement("canvas");
      const webglAvailable = Boolean(
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
      );

      if (reducedMotion) {
        setCapability({ canLoad: false, fallbackMode: "reduced-motion" });
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
    >
      <div className={styles.courseTwinCopy}>
        <p className={styles.eyebrow}>Course Twin · pilot</p>
        <h2 id="course-twin-title">Take trusted bag data into a mapped hole decision.</h2>
        <p>
          Course Twin connects safe targets, planned clubs, expected carry and the common miss. It
          is a pilot: reconstructed movement and modelled outcomes remain visibly separate from
          measured launch-monitor evidence.
        </p>
        <div className={styles.twinProof}>
          <ShieldCheck className="size-5" aria-hidden />
          <span>
            <strong>Evidence stays honest</strong>Measured rows, reconstructed terrain and modelled
            completion never get conflated.
          </span>
        </div>
      </div>
      <ScrollZoomFrame
        className={styles.courseTwinDemo}
        onClick={() => trackPlausibleEvent("Public Course Twin Demo Opened")}
      >
        {Runtime ? <Runtime /> : <CourseTwinStaticFallback mode={fallbackMode} />}
      </ScrollZoomFrame>
    </section>
  );
}
