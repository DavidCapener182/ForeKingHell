import Image from "next/image";

import { clubArtworkPath, clubImageRoutePath } from "@/lib/club-images";
import { cn } from "@/lib/utils";

type ClubArtworkView = "side" | "top";
type ClubArtworkSource = "panel" | "generated-v2";

export function ClubArtwork({
  clubType,
  brand,
  model,
  alt,
  view = "side",
  source = "panel",
  className,
  imageClassName,
  priority = false,
  sizes = "(min-width: 1024px) 180px, 46vw",
}: {
  clubType: string | null | undefined;
  brand?: string | null;
  model?: string | null;
  alt: string;
  view?: ClubArtworkView;
  source?: ClubArtworkSource;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const fallbackSrc = clubArtworkPath(clubType, view, source);
  const realClubSrc = clubImageRoutePath({
    type: clubType,
    brand,
    model,
    fallback: fallbackSrc,
  });

  return (
    <div
      data-media-container
      className={cn(
        "relative aspect-[16/9] min-h-14 overflow-hidden rounded-lg border border-slate-200 bg-white",
        className,
      )}
      aria-hidden={alt === ""}
    >
      {realClubSrc ? (
        <Image
          src={realClubSrc}
          alt={alt}
          fill
          loading={priority ? "eager" : "lazy"}
          sizes={sizes}
          unoptimized
          className={cn("object-contain px-3 py-2 drop-shadow-sm", imageClassName)}
        />
      ) : (
        <Image
          src={fallbackSrc}
          alt={alt}
          fill
          loading={priority ? "eager" : "lazy"}
          sizes={sizes}
          className={cn("object-contain px-3 py-2 drop-shadow-sm", imageClassName)}
        />
      )}
      <div className="absolute inset-x-4 bottom-3 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />
    </div>
  );
}
