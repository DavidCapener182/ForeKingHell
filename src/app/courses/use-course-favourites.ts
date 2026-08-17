"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { setCourseFavouriteAction } from "@/app/courses/actions";

export function useCourseFavourites(initialFavourites: string[] = []) {
  const [favourites, setFavourites] = useState(() => new Set(initialFavourites));
  const [isPending, startTransition] = useTransition();
  const [pendingCourseIds, setPendingCourseIds] = useState(() => new Set<string>());
  const favouritesRef = useRef(favourites);
  const requestVersionsRef = useRef(new Map<string, number>());

  useEffect(() => {
    favouritesRef.current = favourites;
  }, [favourites]);

  function toggleFavourite(courseId: string) {
    const next = new Set(favouritesRef.current);
    const shouldFavourite = !next.has(courseId);
    const requestVersion = (requestVersionsRef.current.get(courseId) ?? 0) + 1;
    requestVersionsRef.current.set(courseId, requestVersion);

    if (shouldFavourite) next.add(courseId);
    else next.delete(courseId);
    favouritesRef.current = next;
    setFavourites(next);
    setPendingCourseIds((current) => new Set(current).add(courseId));

    startTransition(async () => {
      try {
        await setCourseFavouriteAction(courseId, shouldFavourite);
        if (requestVersionsRef.current.get(courseId) !== requestVersion) return;
      } catch {
        if (requestVersionsRef.current.get(courseId) !== requestVersion) return;
        const rollback = new Set(favouritesRef.current);
        if (shouldFavourite) rollback.delete(courseId);
        else rollback.add(courseId);
        favouritesRef.current = rollback;
        setFavourites(rollback);
      } finally {
        if (requestVersionsRef.current.get(courseId) === requestVersion) {
          setPendingCourseIds((current) => {
            const nextPending = new Set(current);
            nextPending.delete(courseId);
            return nextPending;
          });
        }
      }
    });
  }

  return { favourites, isPending, pendingCourseIds, toggleFavourite };
}
