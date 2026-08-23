"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import styles from "./cinematic.module.css";

const transitions = [
  { section: "how-it-works", startX: 0.34, endX: 0.72 },
  { section: "course-twin", startX: 0.7, endX: 0.3 },
  { section: "practice", startX: 0.31, endX: 0.74 },
  { section: "product-screens", startX: 0.72, endX: 0.38 },
  { section: "features", startX: 0.4, endX: 0.76 },
  { section: "privacy", startX: 0.73, endX: 0.28 },
  { section: "pricing", startX: 0.3, endX: 0.68 },
] as const;

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function StoryContinuity() {
  const markerRef = useRef<HTMLSpanElement>(null);
  const tracerRef = useRef<SVGSVGElement>(null);
  const tracerPathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const marker = markerRef.current;
    const tracer = tracerRef.current;
    const tracerPath = tracerPathRef.current;
    if (!marker || !tracer || !tracerPath) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let boundaries: number[] = [];

    const refreshBoundaries = () => {
      boundaries = transitions.map(({ section }) => {
        const element = document.getElementById(section);
        if (!element) return Number.NaN;
        const bounds = element.getBoundingClientRect();
        return window.scrollY + bounds.bottom;
      });
    };

    const update = () => {
      animationFrame = 0;
      if (reducedMotion.matches) {
        marker.style.opacity = "0";
        tracer.style.opacity = "0";
        return;
      }

      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY;
      let activeIndex = -1;
      let progress = 0;

      for (let index = 0; index < boundaries.length; index += 1) {
        const boundary = boundaries[index];
        if (!Number.isFinite(boundary)) continue;
        const start = boundary - viewportHeight * 0.56;
        const end = boundary + viewportHeight * 0.56;
        if (scrollY >= start && scrollY <= end) {
          activeIndex = index;
          progress = clampUnit((scrollY - start) / (end - start));
          break;
        }
      }

      if (activeIndex < 0) {
        marker.style.opacity = "0";
        tracer.style.opacity = "0";
        return;
      }

      const transition = transitions[activeIndex];
      const eased = progress * progress * (3 - 2 * progress);
      const viewportWidth = window.innerWidth;
      const direction = Math.sign(transition.endX - transition.startX) || 1;
      const startX = transition.startX * viewportWidth;
      const startY = viewportHeight * 1.07;
      const endX = transition.endX * viewportWidth;
      const endY = viewportHeight * 0.18;
      const controlOneX = startX - direction * viewportWidth * 0.035;
      const controlOneY = viewportHeight * 0.73;
      const controlTwoX = endX - direction * viewportWidth * 0.14;
      const controlTwoY = viewportHeight * 0.2;
      const inverse = 1 - eased;
      const firstSplitX = startX + (controlOneX - startX) * eased;
      const firstSplitY = startY + (controlOneY - startY) * eased;
      const middleSplitX = controlOneX + (controlTwoX - controlOneX) * eased;
      const middleSplitY = controlOneY + (controlTwoY - controlOneY) * eased;
      const firstControlX = firstSplitX + (middleSplitX - firstSplitX) * eased;
      const firstControlY = firstSplitY + (middleSplitY - firstSplitY) * eased;
      const x =
        inverse ** 3 * startX +
        3 * inverse ** 2 * eased * controlOneX +
        3 * inverse * eased ** 2 * controlTwoX +
        eased ** 3 * endX;
      const y =
        inverse ** 3 * startY +
        3 * inverse ** 2 * eased * controlOneY +
        3 * inverse * eased ** 2 * controlTwoY +
        eased ** 3 * endY;
      const fadeIn = clampUnit(progress / 0.08);
      const fadeOut = 1 - clampUnit((progress - 0.84) / 0.16);
      const opacity = fadeIn * fadeOut * 0.96;
      const rotation = activeIndex * 95 + eased * direction * 720;
      const scale = 0.82 + Math.sin(Math.PI * eased) * 0.24;

      tracer.setAttribute("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`);
      tracerPath.setAttribute(
        "d",
        `M ${startX.toFixed(2)} ${startY.toFixed(2)} C ${firstSplitX.toFixed(2)} ${firstSplitY.toFixed(2)}, ${firstControlX.toFixed(2)} ${firstControlY.toFixed(2)}, ${x.toFixed(2)} ${y.toFixed(2)}`,
      );
      tracer.style.opacity = (opacity * 0.64).toFixed(3);

      marker.style.opacity = opacity.toFixed(3);
      marker.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rotation.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
    };

    const requestUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(update);
    };
    const refresh = () => {
      refreshBoundaries();
      requestUpdate();
    };

    refresh();
    document.fonts.ready.then(refresh).catch(() => undefined);
    const page = marker.closest("main");
    const resizeObserver = page ? new ResizeObserver(refresh) : null;
    if (page) resizeObserver?.observe(page);
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", refresh, { passive: true });
    reducedMotion.addEventListener("change", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", refresh);
      reducedMotion.removeEventListener("change", requestUpdate);
      resizeObserver?.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <>
      <svg
        className={styles.storyContinuityTracer}
        aria-hidden
        preserveAspectRatio="none"
        ref={tracerRef}
      >
        <path ref={tracerPathRef} />
      </svg>
      <span className={styles.storyContinuity} aria-hidden ref={markerRef}>
        <Image src="/assets/landing/golf-ball.png" alt="" width={256} height={256} sizes="32px" />
      </span>
    </>
  );
}
