import Image from "next/image";

import { cn } from "@/lib/utils";

type ClubArtworkView = "side" | "top";
type ClubArtworkSource = "panel" | "generated-v2";

const knownClubArt = new Set(["driver", "5w", "5i", "6i", "7i", "8i", "9i", "pw", "sw"]);

const clubArtAliases: Record<string, string> = {
  "3w": "5w",
  "7w": "5w",
  "3h": "5i",
  "4h": "5i",
  "5h": "5i",
  "4i": "5i",
  gw: "pw",
  lw: "sw",
};

export function clubArtworkPath(
  clubType: string | null | undefined,
  view: ClubArtworkView = "side",
  source: ClubArtworkSource = "panel",
) {
  const normalized = (clubType ?? "").trim().toLowerCase();
  const artType = knownClubArt.has(normalized) ? normalized : clubArtAliases[normalized] ?? "7i";

  return `/assets/clubs/${source}/${artType}-${view}.png`;
}

export function ClubArtwork({
  clubType,
  alt,
  view = "side",
  source = "panel",
  className,
  imageClassName,
  priority = false,
  sizes = "(min-width: 1024px) 180px, 46vw",
}: {
  clubType: string | null | undefined;
  alt: string;
  view?: ClubArtworkView;
  source?: ClubArtworkSource;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "relative min-h-20 overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-white via-slate-50 to-emerald-50/50 shadow-sm",
        className,
      )}
      aria-hidden={alt === ""}
    >
      <Image
        src={clubArtworkPath(clubType, view, source)}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn("object-contain px-3 py-2 drop-shadow-sm", imageClassName)}
      />
      <div className="absolute inset-x-4 bottom-3 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />
    </div>
  );
}
