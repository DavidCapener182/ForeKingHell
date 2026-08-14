"use client";

import { useState, useTransition } from "react";

import { setCourseFavouriteAction } from "@/app/courses/actions";

export function useCourseFavourites(initialFavourites: string[] = []) {
  const [favourites, setFavourites] = useState(() => new Set(initialFavourites));
  const [isPending, startTransition] = useTransition();

  function toggleFavourite(courseId: string) {
    const previous = new Set(favourites);
    const next = new Set(favourites);
    const shouldFavourite = !next.has(courseId);

    if (shouldFavourite) next.add(courseId);
    else next.delete(courseId);
    setFavourites(next);

    startTransition(async () => {
      try {
        await setCourseFavouriteAction(courseId, shouldFavourite);
      } catch {
        setFavourites(previous);
      }
    });
  }

  return { favourites, isPending, toggleFavourite };
}
