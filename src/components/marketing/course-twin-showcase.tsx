"use client";

import { MapPinned, Play, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type ComponentType } from "react";

import { trackPlausibleEvent } from "@/lib/analytics";

import { useInViewOnce } from "./reveal";
import { ScrollZoomFrame } from "./scroll-zoom-frame";
import styles from "./marketing.module.css";

export function CourseTwinShowcase() {
  const { ref, isVisible } = useInViewOnce<HTMLElement>("280px 0px");
  const [Runtime, setRuntime] = useState<ComponentType | null>(null);
  const [canLoadRuntime, setCanLoadRuntime] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const compactViewport = window.matchMedia("(max-width: 767px)").matches;
      const connection = (navigator as Navigator & { connection?: unknown }).connection as
        | { saveData?: boolean; effectiveType?: string }
        | undefined;
      const lowPowerConnection =
        connection?.saveData ||
        connection?.effectiveType === "slow-2g" ||
        connection?.effectiveType === "2g";
      const canvas = document.createElement("canvas");
      const webglAvailable = Boolean(
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
      );

      setCanLoadRuntime(
        !reducedMotion && !compactViewport && !lowPowerConnection && webglAvailable,
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isVisible || !canLoadRuntime || Runtime) return;
    let mounted = true;
    void import("./course-twin-demo-runtime")
      .then((module) => {
        if (mounted) setRuntime(() => module.default);
      })
      .catch(() => {
        // The static mapped-hole preview remains available when optional runtime loading fails.
      });
    return () => {
      mounted = false;
    };
  }, [Runtime, canLoadRuntime, isVisible]);

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
          <ShieldCheck className="size-5" />
          <span>
            <strong>Evidence stays honest</strong>Measured rows, replay and modelled completion
            never get conflated.
          </span>
        </div>
      </div>
      <ScrollZoomFrame
        className={styles.courseTwinDemo}
        onClick={() => trackPlausibleEvent("Public Course Twin Demo Opened")}
      >
        {Runtime ? <Runtime /> : <CourseTwinStaticFallback loading={isVisible && canLoadRuntime} />}
      </ScrollZoomFrame>
    </section>
  );
}

function CourseTwinStaticFallback({ loading = false }: { loading?: boolean }) {
  return (
    <div className={styles.twinFallback}>
      <div className={styles.twinFallbackMap}>
        <Image
          className={styles.twinAerialImage}
          src="/assets/generated/lmwt-course-twin-aerial.png"
          alt="Aerial view of a mapped golf hole used as a Course Twin demo"
          fill
          sizes="(max-width: 850px) 100vw, 52vw"
        />
        <div className={styles.twinAerialShade} aria-hidden />
        <span className={styles.twinFallbackRoute} aria-hidden />
        <span className={styles.twinFallbackStart}>Tee</span>
        <span className={styles.twinFallbackDistance}>220 yd carry</span>
        <b>Safe target</b>
        <i>Mapped green</i>
      </div>
      <div className={styles.twinFallbackStats}>
        <span>
          <MapPinned className="size-4" /> Mapped-hole preview
        </span>
        <span>
          <Play className="size-4" />{" "}
          {loading ? "Loading interactive route…" : "Interactive route loads near this section"}
        </span>
      </div>
    </div>
  );
}
