"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type ScrollZoomFrameProps = ComponentPropsWithoutRef<"div">;

/**
 * Updates only the composited elements that opt into scroll zoom while a scene is
 * near the viewport. Writing transforms on the moving elements avoids invalidating
 * every descendant through an inherited CSS custom property.
 */
export function ScrollZoomFrame({ className, ...props }: ScrollZoomFrameProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactLayoutQuery = window.matchMedia("(max-width: 767px)");
    const supportsNativeTimeline = CSS.supports("animation-timeline: view()");
    const fallbackTargets = Array.from(
      element.querySelectorAll<HTMLElement>("[data-scroll-zoom-target]"),
    )
      .filter((target) => !(supportsNativeTimeline && target.dataset.scrollZoomNative === "true"))
      .map((target) => ({
        target,
        minimum: Number(target.dataset.scrollZoomMin ?? 1),
        scaleRange: Number(target.dataset.scrollZoomRange ?? 0.1),
      }));

    if (fallbackTargets.length === 0) return;

    let intersecting = false;
    let listening = false;
    let frame: number | null = null;

    const motionAllowed = () => !reducedMotionQuery.matches && !compactLayoutQuery.matches;

    const clearTargetTransforms = () => {
      fallbackTargets.forEach(({ target }) => {
        target.style.removeProperty("transform");
      });
    };

    const removeViewportListeners = () => {
      if (!listening) return;
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      listening = false;
    };

    const cancelPendingFrame = () => {
      if (frame === null) return;
      window.cancelAnimationFrame(frame);
      frame = null;
    };

    const update = () => {
      frame = null;
      if (!intersecting || !motionAllowed()) return;
      const rect = element.getBoundingClientRect();
      const viewport = Math.max(window.innerHeight, 1);
      const range = viewport + rect.height;
      const progress = Math.min(1, Math.max(0, (viewport - rect.top) / range));
      const zoom = 1 - Math.abs(progress * 2 - 1);

      fallbackTargets.forEach(({ target, minimum, scaleRange }) => {
        const scale = minimum + zoom * scaleRange;
        target.style.transform = `scale(${scale.toFixed(4)})`;
      });
    };

    const requestUpdate = () => {
      if (frame !== null || !intersecting || !motionAllowed()) return;
      frame = window.requestAnimationFrame(update);
    };

    const syncMotion = () => {
      if (!intersecting || !motionAllowed()) {
        removeViewportListeners();
        cancelPendingFrame();
        clearTargetTransforms();
        return;
      }

      if (!listening) {
        window.addEventListener("scroll", requestUpdate, { passive: true });
        window.addEventListener("resize", requestUpdate, { passive: true });
        listening = true;
      }
      requestUpdate();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = Boolean(entry?.isIntersecting);
        syncMotion();
      },
      { rootMargin: "18% 0px", threshold: 0 },
    );

    reducedMotionQuery.addEventListener("change", syncMotion);
    compactLayoutQuery.addEventListener("change", syncMotion);
    observer.observe(element);
    return () => {
      observer.disconnect();
      reducedMotionQuery.removeEventListener("change", syncMotion);
      compactLayoutQuery.removeEventListener("change", syncMotion);
      removeViewportListeners();
      cancelPendingFrame();
      clearTargetTransforms();
    };
  }, []);

  return <div ref={ref} className={cn(className)} {...props} />;
}
