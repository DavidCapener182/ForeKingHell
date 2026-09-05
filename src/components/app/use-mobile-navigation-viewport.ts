"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createMobileHistoryEntry,
  mobileHistoryScrollKey,
  mobileNavigationLocation,
  mobilePageScrollLocked,
  mobileScrollKey,
  preserveMobileHistoryEntry,
  readMobileScroll,
  restoreMobileScroll,
} from "@/lib/mobile-navigation-scroll";

export function useMobileNavigationViewport(location: string) {
  const [headingState, setHeadingState] = useState({ location: "", title: "", visible: false });
  const pending = useRef<{ destination: string; top: number } | null>(null);
  const entryKey = useRef<string | null>(null);
  const lastLocation = useRef<string | null>(null);
  const historyNavigation = useRef(false);
  const cancelRestore = useRef<(() => void) | null>(null);
  const remember = useCallback(() => {
    if (pending.current || mobilePageScrollLocked()) return;
    if (mobileNavigationLocation(window.location.href) !== location) return;
    try {
      const top = String(Math.max(0, window.scrollY));
      window.sessionStorage.setItem(mobileScrollKey(location), top);
      if (entryKey.current) {
        window.sessionStorage.setItem(entryKey.current, top);
        preserveMobileHistoryEntry(location, entryKey.current);
      }
    } catch {
      /* Restricted storage leaves ordinary navigation available. */
    }
  }, [location]);

  const prepareNavigation = useCallback(
    (href: string) => {
      cancelRestore.current?.();
      remember();
      const destination = mobileNavigationLocation(href);
      if (destination === location) {
        window.scrollTo({ top: 0, behavior: "instant" });
        remember();
        return true;
      }
      pending.current = { destination, top: readMobileScroll(mobileScrollKey(destination)) };
      return false;
    },
    [location, remember],
  );

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const interrupt = () => {
      pending.current = null;
      cancelRestore.current?.();
    };
    for (const event of ["touchstart", "wheel", "keydown"] as const) {
      window.addEventListener(event, interrupt, { passive: true, capture: true });
    }
    return () => {
      window.history.scrollRestoration = previous;
      for (const event of ["touchstart", "wheel", "keydown"] as const) {
        window.removeEventListener(event, interrupt, true);
      }
    };
  }, []);

  useEffect(() => {
    const existingEntry = mobileHistoryScrollKey(location);
    const sameVisit = lastLocation.current === location;
    const navigationType = (
      performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    )?.type;
    if (
      (lastLocation.current === null || sameVisit) &&
      existingEntry &&
      !pending.current &&
      (navigationType === "reload" || navigationType === "back_forward") &&
      window.scrollY === 0
    ) {
      pending.current = { destination: location, top: readMobileScroll(existingEntry) };
    }
    entryKey.current =
      existingEntry && (historyNavigation.current || lastLocation.current === null || sameVisit)
        ? existingEntry
        : createMobileHistoryEntry(location);
    historyNavigation.current = false;
    lastLocation.current = location;
    let frame: number | null = null;
    let scrollChanged = false;
    const updateTitle = () => {
      frame = null;
      if (scrollChanged) {
        scrollChanged = false;
        remember();
      }
      const heading = Array.from(document.querySelectorAll<HTMLElement>("main h1")).find(
        (element) => element.getClientRects().length > 0,
      );
      const bar = document.querySelector<HTMLElement>("[aria-label='Mobile app bar']");
      const title = heading?.textContent?.trim() ?? "";
      const visible = Boolean(
        heading &&
        bar &&
        heading.getBoundingClientRect().bottom <= bar.getBoundingClientRect().bottom,
      );
      setHeadingState((previous) =>
        previous.location === location && previous.title === title && previous.visible === visible
          ? previous
          : { location, title, visible },
      );
    };
    const queueTitle = () => {
      if (frame === null) frame = requestAnimationFrame(updateTitle);
    };
    const handleScroll = () => {
      scrollChanged = true;
      queueTitle();
    };
    const beginRestoration = (request: { destination: string; top: number }) => {
      cancelRestore.current = restoreMobileScroll(request.top, (restored) => {
        if (pending.current === request) pending.current = null;
        if (restored) remember();
        queueTitle();
      });
    };
    const onHistoryNavigation = (event: PopStateEvent) => {
      cancelRestore.current?.();
      const destination = mobileNavigationLocation(window.location.href);
      const key = mobileHistoryScrollKey(destination, event.state);
      const request = { destination, top: readMobileScroll(key ?? mobileScrollKey(destination)) };
      pending.current = request;
      historyNavigation.current = true;
      if (destination === location) {
        entryKey.current = key ?? createMobileHistoryEntry(location);
        historyNavigation.current = false;
        beginRestoration(request);
      }
    };
    const request = pending.current;
    if (request?.destination === location) beginRestoration(request);
    else if (request) pending.current = null;
    const mutation = new MutationObserver(queueTitle);
    const resize = new ResizeObserver(queueTitle);
    mutation.observe(document.body, { childList: true, characterData: true, subtree: true });
    resize.observe(document.body);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", queueTitle);
    // Capture before Next can synchronously commit and replace this route effect.
    window.addEventListener("popstate", onHistoryNavigation, true);
    window.addEventListener("pagehide", remember);
    queueTitle();
    return () => {
      cancelRestore.current?.();
      cancelRestore.current = null;
      mutation.disconnect();
      resize.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", queueTitle);
      window.removeEventListener("popstate", onHistoryNavigation, true);
      window.removeEventListener("pagehide", remember);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [location, remember]);

  return {
    compactTitleVisible: headingState.location === location && headingState.visible,
    compactTitle: headingState.location === location ? headingState.title : "",
    prepareNavigation,
  };
}
