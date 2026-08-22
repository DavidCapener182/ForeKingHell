"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";

import { trackPlausibleEvent } from "@/lib/analytics";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import {
  CourseTwinStaticFallback,
  type CourseTwinFallbackMode,
} from "./course-twin/course-twin-static-fallback";
import { useInViewOnce } from "./reveal";
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
      <div
        className={styles.courseTwinDemo}
        onClick={() => trackPlausibleEvent("Public Course Twin Demo Opened")}
      >
        <div className={`t-skel ${styles.courseTwinSwap} ${Runtime ? "is-revealed" : ""}`}>
          <div className="t-skel-skeleton" aria-hidden={Runtime ? true : undefined}>
            <CourseTwinDemoState mode={fallbackMode} />
          </div>
          <div className="t-skel-content">{Runtime ? <Runtime /> : null}</div>
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
          <ShieldCheck className="size-4" />
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
