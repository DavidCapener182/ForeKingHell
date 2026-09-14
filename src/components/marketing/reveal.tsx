"use client";

import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

const registeredReveals = new Set<HTMLElement>();
const registeredScenes = new Map<HTMLElement, number>();
const activeScenes = new Set<HTMLElement>();
let revealObserver: IntersectionObserver | null = null;
let sceneObserver: IntersectionObserver | null = null;
let motionQuery: MediaQueryList | null = null;
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
  // Measure each nearby scene once, before writing styles. Text entrances are
  // handled separately by IntersectionObserver and finish even when scrolling stops.
  const scenes = reducedMotion ? registeredScenes.keys() : activeScenes;
  const measurements = Array.from(scenes, (section) => ({
    section,
    bounds: section.getBoundingClientRect(),
  }));
  for (const { section, bounds } of measurements) {
    const progress = reducedMotion ? 1 : clampUnit((viewportHeight - bounds.top) / viewportHeight);
    updateScene(section, bounds, viewportHeight, progress, reducedMotion, compactViewport);
  }
}

function revealElement(element: HTMLElement) {
  element.dataset.marketingReveal = "visible";
  revealObserver?.unobserve(element);
}

function revealFocusedContent(event: FocusEvent) {
  if (!(event.target instanceof Element)) return;
  let reveal = event.target.closest<HTMLElement>("[data-marketing-reveal]");
  while (reveal) {
    revealElement(reveal);
    reveal = reveal.parentElement?.closest<HTMLElement>("[data-marketing-reveal]") ?? null;
  }
}

function syncMotionPreference() {
  if (motionQuery?.matches) registeredReveals.forEach(revealElement);
  requestRevealUpdate();
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
  // A restored tab or deep link must never return to hidden, already-read copy.
  for (const element of registeredReveals) {
    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) revealElement(element);
  }
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
    motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) revealElement(entry.target as HTMLElement);
        }
      },
      { rootMargin: "0px 0px -8%", threshold: 0 },
    );
    sceneObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const section = entry.target as HTMLElement;
          if (entry.isIntersecting) activeScenes.add(section);
          else activeScenes.delete(section);
        }
        requestRevealUpdate();
      },
      { rootMargin: "20% 0px", threshold: 0 },
    );
    window.addEventListener("scroll", requestRevealUpdate, { passive: true });
    window.addEventListener("resize", requestRevealUpdate, { passive: true });
    window.addEventListener("pageshow", refreshAfterScrollRestore);
    window.addEventListener("load", refreshAfterScrollRestore);
    document.addEventListener("focusin", revealFocusedContent);
    motionQuery.addEventListener("change", syncMotionPreference);
    refreshAfterScrollRestore();
  }
  // Preserve SSR and above-the-fold content. Only unseen content starts concealed.
  if (motionQuery?.matches || element.getBoundingClientRect().top < window.innerHeight * 0.92) {
    revealElement(element);
  } else {
    revealObserver?.observe(element);
  }
  const section = element.closest<HTMLElement>("[data-scroll-pause]");
  if (section) {
    const count = registeredScenes.get(section) ?? 0;
    registeredScenes.set(section, count + 1);
    if (count === 0) sceneObserver?.observe(section);
  }
  activateRevealMotion();
  requestRevealUpdate();

  return () => {
    registeredReveals.delete(element);
    revealObserver?.unobserve(element);
    if (section) {
      const count = (registeredScenes.get(section) ?? 1) - 1;
      if (count > 0) registeredScenes.set(section, count);
      else {
        registeredScenes.delete(section);
        activeScenes.delete(section);
        sceneObserver?.unobserve(section);
        sceneTargetCache.delete(section);
      }
    }
    if (registeredReveals.size === 0 && revealListenersActive) {
      revealListenersActive = false;
      window.removeEventListener("scroll", requestRevealUpdate);
      window.removeEventListener("resize", requestRevealUpdate);
      window.removeEventListener("pageshow", refreshAfterScrollRestore);
      window.removeEventListener("load", refreshAfterScrollRestore);
      document.removeEventListener("focusin", revealFocusedContent);
      motionQuery?.removeEventListener("change", syncMotionPreference);
      revealObserver?.disconnect();
      sceneObserver?.disconnect();
      revealObserver = null;
      sceneObserver = null;
      motionQuery = null;
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
