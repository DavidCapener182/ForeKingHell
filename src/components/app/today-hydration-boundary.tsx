"use client";

import { useEffect, useSyncExternalStore } from "react";

// The shell can hydrate before Today's streamed route boundary. Radix must not
// aria-hide that boundary's server DOM until its own hydration has committed.
let committedBoundaries = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => committedBoundaries > 0;
const getServerSnapshot = () => false;

export function useTodayRouteCommitted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function TodayHydrationBoundary() {
  useEffect(() => {
    committedBoundaries += 1;
    listeners.forEach((listener) => listener());
    return () => {
      committedBoundaries -= 1;
      listeners.forEach((listener) => listener());
    };
  }, []);
  return null;
}
