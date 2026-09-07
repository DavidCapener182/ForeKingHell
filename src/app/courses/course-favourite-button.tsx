"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

import { useCourseFavourites } from "@/app/courses/use-course-favourites";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CourseFavouriteButton({
  courseId,
  courseName,
  initialFavourite,
}: {
  courseId: string;
  courseName: string;
  initialFavourite: boolean;
}) {
  const { favourites, isPending, toggleFavourite, error } = useCourseFavourites(
    initialFavourite ? [courseId] : [],
  );
  const favourite = favourites.has(courseId);
  const [motionReady, setMotionReady] = useState(false);

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className={cn(
          "min-h-11",
          motionReady && "t-like",
          "[--like-color:currentColor]",
          favourite && "border-primary/30 text-primary",
        )}
        data-liked={favourite ? "true" : "false"}
        onClick={() => {
          setMotionReady(true);
          toggleFavourite(courseId);
        }}
        disabled={isPending}
        aria-busy={isPending}
        aria-pressed={favourite}
        aria-label={favourite ? `Remove ${courseName} from favourites` : `Favourite ${courseName}`}
      >
        <span className="t-like-icon inline-flex" aria-hidden="true">
          <Heart className={cn("t-like-heart size-4", favourite && "fill-current")} />
        </span>
        {isPending ? "Saving favourite…" : favourite ? "Favourite" : "Add favourite"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
