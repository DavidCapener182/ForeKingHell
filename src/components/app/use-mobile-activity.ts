"use client";

import { useEffect } from "react";

/** An activity owns the screen only while it is running. */
export function useMobileActivity(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const shell = document.querySelector<HTMLElement>("[data-app-surface='companion']");
    if (shell) shell.dataset.mobileFlow = "immersive";
    let cancelled = false;
    let lock: WakeLockSentinel | null = null;
    let acquiring = false;
    const acquire = async () => {
      if (
        cancelled ||
        acquiring ||
        document.visibilityState !== "visible" ||
        lock ||
        !("wakeLock" in navigator)
      )
        return;
      acquiring = true;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled || document.visibilityState !== "visible") {
          await next.release();
          return;
        }
        if (next.released) return;
        lock = next;
        next.addEventListener(
          "release",
          () => {
            if (lock === next) lock = null;
          },
          { once: true },
        );
      } catch {
        /* Auto-lock remains available when the OS declines. */
      } finally {
        acquiring = false;
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelled = true;
      if (shell) delete shell.dataset.mobileFlow;
      document.removeEventListener("visibilitychange", visibility);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

export function activityHaptic() {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) navigator.vibrate?.(12);
}
