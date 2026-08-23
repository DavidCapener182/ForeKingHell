"use client";

import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

const registeredReveals = new Set<HTMLElement>();
let revealAnimationFrame = 0;
let revealActivationFrame = 0;
let revealListenersActive = false;
let revealRestoreTimers: number[] = [];

type ScenePhase =
  | "intro"
  | "line"
  | "zone"
  | "resolve"
  | "ui"
  | "establish"
  | "tee"
  | "hazards"
  | "target"
  | "route"
  | "twin";
type SceneElement = HTMLElement | SVGElement;
type SceneTargets = {
  floats: SceneElement[];
  parallax: SceneElement[];
  phased: Array<{ element: SceneElement; phases: ScenePhase[] }>;
  progress: SceneElement[];
};

const sceneTargetCache = new WeakMap<HTMLElement, SceneTargets>();

const phaseWindows: Record<ScenePhase, readonly [number, number]> = {
  intro: [0.04, 0.22],
  line: [0.2, 0.42],
  zone: [0.4, 0.62],
  resolve: [0.6, 0.8],
  ui: [0.78, 0.96],
  establish: [0.02, 0.16],
  tee: [0.13, 0.29],
  hazards: [0.27, 0.45],
  target: [0.42, 0.61],
  route: [0.56, 0.74],
  twin: [0.84, 0.98],
};

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function scenePhase(progress: number, start: number, end: number) {
  const phase = clampUnit((progress - start) / (end - start));
  return phase * phase * (3 - 2 * phase);
}

function getSceneTargets(section: HTMLElement) {
  const cached = sceneTargetCache.get(section);
  if (cached) return cached;

  const targets: SceneTargets = {
    floats: Array.from(section.querySelectorAll<SceneElement>("[data-scene-float]")),
    parallax: Array.from(section.querySelectorAll<SceneElement>("[data-scene-parallax]")),
    phased: Array.from(section.querySelectorAll<SceneElement>("[data-scene-vars]"), (element) => ({
      element,
      phases: (element.getAttribute("data-scene-vars") ?? "")
        .split(/\s+/)
        .filter((phase): phase is ScenePhase => phase in phaseWindows),
    })),
    progress: Array.from(section.querySelectorAll<SceneElement>("[data-scene-progress]")),
  };

  sceneTargetCache.set(section, targets);
  return targets;
}

function updateScene(
  section: HTMLElement,
  bounds: DOMRect,
  viewportHeight: number,
  revealProgress: number,
  reducedMotion: boolean,
  compactViewport: boolean,
) {
  const scrollableDistance = Math.max(
    bounds.height - viewportHeight,
    viewportHeight * (compactViewport ? 0.3 : 0.45),
  );
  const progress = reducedMotion ? 1 : clampUnit(-bounds.top / scrollableDistance);
  const targets = getSceneTargets(section);
  const y = `${((0.5 - progress) * 6).toFixed(3)}rem`;
  const scale = (1.075 - progress * 0.025).toFixed(4);
  const floatY = `${((1 - progress) * 3.5).toFixed(3)}rem`;
  const floatX = `${((1 - progress) * 3).toFixed(3)}rem`;
  const floatXNegative = `${((1 - progress) * -3).toFixed(3)}rem`;

  for (const target of targets.parallax) {
    target.style.setProperty("--scene-y", y);
    target.style.setProperty("--scene-scale", scale);
  }
  for (const target of targets.progress) {
    target.style.setProperty("--scene-progress", progress.toFixed(4));
  }
  for (const target of targets.floats) {
    target.style.setProperty("--pause-progress", revealProgress.toFixed(3));
    target.style.setProperty("--scene-float-y", floatY);
    target.style.setProperty("--scene-float-x", floatX);
    target.style.setProperty("--scene-float-x-negative", floatXNegative);
  }
  for (const { element, phases } of targets.phased) {
    for (const phase of phases) {
      const [start, end] = phaseWindows[phase];
      element.style.setProperty(
        `--scene-phase-${phase}`,
        scenePhase(progress, start, end).toFixed(4),
      );
    }
  }
}

function updateRegisteredReveals() {
  revealAnimationFrame = 0;
  const viewportHeight = window.innerHeight;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compactViewport = window.matchMedia("(max-width: 767px)").matches;
  const boundsCache = new Map<HTMLElement, DOMRect>();
  const updatedScenes = new Set<HTMLElement>();

  for (const element of registeredReveals) {
    const pauseSection = element.closest<HTMLElement>("[data-scroll-pause]");
    // Every item in a chapter follows the chapter entrance. This lets the mobile
    // composition complete before lower copy is reached instead of revealing each
    // row after it has already started leaving the viewport.
    const target = pauseSection ?? element;
    const targetBounds = boundsCache.get(target) ?? target.getBoundingClientRect();
    boundsCache.set(target, targetBounds);
    const top = targetBounds.top;
    const start = viewportHeight * (compactViewport ? 0.94 : pauseSection ? 0.58 : 0.82);
    const end = viewportHeight * (compactViewport ? 0.68 : pauseSection ? -0.27 : 0.4);
    const rawProgress = reducedMotion ? 1 : clampUnit((start - top) / (start - end));
    const computedStyle = getComputedStyle(element);
    const configuredDelay =
      Number.parseFloat(computedStyle.getPropertyValue("--reveal-delay")) || 0;
    const delay = compactViewport ? Math.min(configuredDelay, 0.06) : configuredDelay;
    const progress = reducedMotion ? 1 : clampUnit((rawProgress - delay) / (1 - delay));
    const revealFrom = element.dataset.revealFrom;
    const configuredOriginX =
      Number.parseFloat(computedStyle.getPropertyValue("--reveal-origin-x")) || 0;
    const originX = revealFrom === "left" ? -3 : revealFrom === "right" ? 3 : configuredOriginX;
    const verticalTravel = revealFrom === "left" || revealFrom === "right" ? 1.4 : 4.5;
    const startingScale = revealFrom === "scale" ? 0.94 : 0.985;

    if (pauseSection && !updatedScenes.has(pauseSection)) {
      updateScene(
        pauseSection,
        targetBounds,
        viewportHeight,
        rawProgress,
        reducedMotion,
        compactViewport,
      );
      updatedScenes.add(pauseSection);
    }

    element.style.setProperty("--reveal-opacity", progress.toFixed(3));
    element.style.setProperty("--reveal-x", `${(originX * (1 - progress)).toFixed(3)}rem`);
    element.style.setProperty(
      "--reveal-y",
      `${((1 - progress) * (compactViewport ? Math.min(verticalTravel, 2.25) : verticalTravel)).toFixed(3)}rem`,
    );
    element.style.setProperty(
      "--reveal-blur",
      `${compactViewport ? 0 : ((1 - progress) * 4).toFixed(3)}px`,
    );
    element.style.setProperty(
      "--reveal-scale",
      (startingScale + progress * (1 - startingScale)).toFixed(4),
    );
    element.dataset.marketingReveal = progress >= 0.999 ? "visible" : "pending";
  }
}

function requestRevealUpdate() {
  if (!revealAnimationFrame)
    revealAnimationFrame = window.requestAnimationFrame(updateRegisteredReveals);
}

function activateRevealMotion() {
  if (revealActivationFrame) return;

  revealActivationFrame = window.requestAnimationFrame(() => {
    revealActivationFrame = 0;
    updateRegisteredReveals();

    const marketingPages = new Set<HTMLElement>();
    for (const reveal of registeredReveals) {
      const marketingPage = reveal.closest<HTMLElement>("[data-marketing-motion]");
      if (marketingPage) marketingPages.add(marketingPage);
    }
    for (const marketingPage of marketingPages) {
      marketingPage.dataset.marketingMotion = "ready";
    }
  });
}

function refreshAfterScrollRestore() {
  requestRevealUpdate();
  revealRestoreTimers.forEach((timer) => window.clearTimeout(timer));
  revealRestoreTimers = [
    window.setTimeout(requestRevealUpdate, 120),
    window.setTimeout(requestRevealUpdate, 520),
  ];
}

function registerReveal(element: HTMLElement) {
  registeredReveals.add(element);
  const marketingPage = element.closest<HTMLElement>("[data-marketing-motion]");
  if (!revealListenersActive) {
    revealListenersActive = true;
    window.addEventListener("scroll", requestRevealUpdate, { passive: true });
    window.addEventListener("resize", requestRevealUpdate, { passive: true });
    window.addEventListener("pageshow", refreshAfterScrollRestore);
    window.addEventListener("load", refreshAfterScrollRestore);
    refreshAfterScrollRestore();
  }
  activateRevealMotion();
  requestRevealUpdate();

  return () => {
    registeredReveals.delete(element);
    if (registeredReveals.size === 0 && revealListenersActive) {
      revealListenersActive = false;
      window.removeEventListener("scroll", requestRevealUpdate);
      window.removeEventListener("resize", requestRevealUpdate);
      window.removeEventListener("pageshow", refreshAfterScrollRestore);
      window.removeEventListener("load", refreshAfterScrollRestore);
      revealRestoreTimers.forEach((timer) => window.clearTimeout(timer));
      revealRestoreTimers = [];
      if (revealAnimationFrame) window.cancelAnimationFrame(revealAnimationFrame);
      if (revealActivationFrame) window.cancelAnimationFrame(revealActivationFrame);
      revealAnimationFrame = 0;
      revealActivationFrame = 0;
      if (marketingPage) marketingPage.dataset.marketingMotion = "idle";
    }
  };
}

export function useInViewOnce<T extends Element>(rootMargin = "0px 0px -30%") {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { rootMargin, threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, isVisible };
}

type RevealElement = "article" | "div" | "p" | "section" | "ul";
type RevealOrigin = "left" | "right" | "scale" | "up";

export function Reveal({
  ariaLabel,
  as = "div",
  children,
  className,
  from,
  sceneVars,
  scrollPause,
}: {
  ariaLabel?: string;
  as?: RevealElement;
  children: ReactNode;
  className?: string;
  from?: RevealOrigin;
  sceneVars?: string;
  scrollPause?: string;
}) {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element) return;
    return registerReveal(element);
  }, [element]);

  return createElement(
    as,
    {
      ref: setElement,
      "aria-label": ariaLabel,
      className,
      "data-marketing-reveal": "pending",
      "data-reveal-from": from,
      "data-scene-vars": sceneVars,
      "data-scroll-pause": scrollPause,
    },
    children,
  );
}
