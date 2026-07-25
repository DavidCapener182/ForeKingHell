"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type ScrollZoomFrameProps = ComponentPropsWithoutRef<"div">;

/**
 * Updates one composited CSS custom property while a scene is near the viewport.
 * The document continues to scroll normally; the value only drives transform and
 * opacity effects in marketing CSS and is disabled for reduced-motion visitors.
 */
export function ScrollZoomFrame({ className, ...props }: ScrollZoomFrameProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let active = false;
    let frame: number | null = null;

    const update = () => {
      frame = null;
      if (!active) return;
      const rect = element.getBoundingClientRect();
      const viewport = Math.max(window.innerHeight, 1);
      const range = viewport + rect.height;
      const progress = Math.min(1, Math.max(0, (viewport - rect.top) / range));
      const zoom = 1 - Math.abs(progress * 2 - 1);
      element.style.setProperty("--marketing-scroll", progress.toFixed(3));
      element.style.setProperty("--marketing-zoom", zoom.toFixed(3));
    };

    const requestUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(update);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        active = Boolean(entry?.isIntersecting);
        if (active) {
          requestUpdate();
          window.addEventListener("scroll", requestUpdate, { passive: true });
          window.addEventListener("resize", requestUpdate, { passive: true });
        } else {
          window.removeEventListener("scroll", requestUpdate);
          window.removeEventListener("resize", requestUpdate);
        }
      },
      { rootMargin: "18% 0px", threshold: 0 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} className={cn(className)} {...props} />;
}
