"use client";

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
  const { favourites, isPending, toggleFavourite } = useCourseFavourites(
    initialFavourite ? [courseId] : [],
  );
  const favourite = favourites.has(courseId);

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("min-h-10", favourite && "border-primary/30 text-primary")}
      onClick={() => toggleFavourite(courseId)}
      disabled={isPending}
      aria-pressed={favourite}
      aria-label={favourite ? `Remove ${courseName} from favourites` : `Favourite ${courseName}`}
    >
      <Heart className={cn("size-4", favourite && "fill-current")} aria-hidden />
      {favourite ? "Favourite" : "Add favourite"}
    </Button>
  );
}
