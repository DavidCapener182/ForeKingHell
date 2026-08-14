"use client";

import { useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "forekinghell-course-favourites";
const CHANGE_EVENT = "forekinghell-course-favourites-change";
const EMPTY_SNAPSHOT = "[]";

export function useCourseFavourites() {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY_SNAPSHOT);
  const favourites = useMemo(() => new Set(parseSnapshot(snapshot)), [snapshot]);

  function toggleFavourite(courseId: string) {
    const next = new Set(favourites);
    if (next.has(courseId)) next.delete(courseId);
    else next.add(courseId);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // The library remains usable when storage is unavailable.
    }
  }

  return { favourites, toggleFavourite };
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function readSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function parseSnapshot(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
