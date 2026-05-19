import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageArtworkVariant =
  | "fairway"
  | "hole"
  | "range"
  | "scorecard"
  | "coach"
  | "equipment"
  | "achievements"
  | "import"
  | "handicap"
  | "courseMap"
  | "courseRecords"
  | "feedEmpty"
  | "feedPb"
  | "profileTrophy"
  | "providerRapsodo"
  | "providerSquare"
  | "providerTrackman"
  | "tourCover"
  | "progress"
  | "rounds"
  | "stockYardages";

export type PageArtworkCrop = "green" | "fairway" | "tee" | "random";

const greenComplexArtwork = "/assets/hole-350-aerial.jpg";

const artworkByVariant: Record<PageArtworkVariant, string> = {
  fairway: greenComplexArtwork,
  hole: greenComplexArtwork,
  range: "/assets/page-today.png",
  scorecard: greenComplexArtwork,
  coach: "/assets/page-coach-drill-board.webp",
  equipment: "/assets/clubs/panel/driver-side.png",
  achievements: "/assets/page-achievements.png",
  import: "/assets/page-import-rapsodo.webp",
  handicap: "/assets/page-handicap-scorecard.webp",
  courseMap: "/assets/course-placeholder-map.webp",
  courseRecords: "/assets/page-course-records-honours.webp",
  feedEmpty: "/assets/feed-empty-state.webp",
  feedPb: "/assets/feed-pb-card-bg.webp",
  profileTrophy: "/assets/profile-trophy-shelf.webp",
  providerRapsodo: "/assets/provider-rapsodo-device.webp",
  providerSquare: "/assets/provider-square-device.webp",
  providerTrackman: "/assets/provider-trackman-radar.webp",
  tourCover: "/assets/tour-covers/tour-cover-01.webp",
  progress: "/assets/page-progress.png",
  rounds: "/assets/page-rounds.png",
  stockYardages: "/assets/page-stock-yardages.png",
};

const cropOptions = ["green", "fairway", "tee"] as const;

const imageTreatmentByCrop: Record<(typeof cropOptions)[number], string> = {
  green: "origin-top object-[50%_0%] opacity-90 saturate-[1.08] brightness-[0.98] scale-[1.65]",
  fairway:
    "origin-center object-[50%_50%] opacity-90 saturate-[1.08] brightness-[0.98] scale-[1.45]",
  tee: "origin-bottom object-[50%_100%] opacity-90 saturate-[1.08] brightness-[0.98] scale-[1.65]",
};

const imageTreatmentByVariant: Partial<Record<PageArtworkVariant, string>> = {
  fairway: imageTreatmentByCrop.green,
  coach: imageTreatmentByCrop.green,
  import: imageTreatmentByCrop.green,
};

const overlayByVariant: Record<PageArtworkVariant, string> = {
  fairway: "from-white/30 via-white/5 to-emerald-950/15",
  hole: "from-white/55 via-sky-50/20 to-emerald-50/20",
  range: "from-white/65 via-white/25 to-sky-50/20",
  scorecard: "from-white/70 via-white/30 to-amber-50/20",
  coach: "from-white/70 via-emerald-50/20 to-sky-50/30",
  equipment: "from-white/85 via-white/45 to-slate-100/30",
  achievements: "from-white/70 via-amber-50/30 to-emerald-50/20",
  import: "from-white/75 via-white/30 to-sky-50/20",
  handicap: "from-white/72 via-amber-50/20 to-emerald-50/20",
  courseMap: "from-white/62 via-sky-50/18 to-emerald-950/10",
  courseRecords: "from-white/58 via-amber-50/18 to-emerald-950/12",
  feedEmpty: "from-white/78 via-sky-50/22 to-emerald-50/20",
  feedPb: "from-black/10 via-transparent to-emerald-950/25",
  profileTrophy: "from-white/68 via-amber-50/24 to-emerald-50/20",
  providerRapsodo: "from-white/74 via-white/25 to-red-50/24",
  providerSquare: "from-white/74 via-slate-50/28 to-sky-50/18",
  providerTrackman: "from-white/74 via-orange-50/20 to-emerald-50/18",
  tourCover: "from-black/8 via-transparent to-black/30",
  progress: "from-white/70 via-emerald-50/25 to-sky-50/25",
  rounds: "from-white/60 via-white/20 to-sky-50/20",
  stockYardages: "from-white/70 via-white/35 to-emerald-50/25",
};

export function PageArtwork({
  variant,
  alt,
  className,
  imageClassName,
  crop,
  cropKey,
  priority = false,
  sizes = "(min-width: 1280px) 420px, (min-width: 768px) 320px, 0px",
}: {
  variant: PageArtworkVariant;
  alt: string;
  className?: string;
  imageClassName?: string;
  crop?: PageArtworkCrop;
  cropKey?: string | number;
  priority?: boolean;
  sizes?: string;
}) {
  const resolvedTreatment = resolveImageTreatment(variant, crop, cropKey);
  const src = resolveArtworkSource(variant, cropKey);

  return (
    <div
      data-media-container
      className={cn(
        "pointer-events-none relative hidden aspect-[16/9] h-full min-h-0 overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F5F6F4] md:block",
        className,
      )}
      aria-hidden={alt === ""}
    >
      <Image
        src={src}
        alt={alt}
        fill
        loading={priority ? "eager" : "lazy"}
        sizes={sizes}
        className={cn("object-cover opacity-80 saturate-[0.92]", resolvedTreatment, imageClassName)}
      />
      <div className={cn("absolute inset-0 bg-gradient-to-br", overlayByVariant[variant])} />
    </div>
  );
}

export function MobileVisualCard({
  children,
  className,
  variant = "fairway",
  crop,
  cropKey,
}: {
  children?: ReactNode;
  className?: string;
  variant?: PageArtworkVariant;
  crop?: PageArtworkCrop;
  cropKey?: string | number;
}) {
  const resolvedTreatment = resolveImageTreatment(variant, crop, cropKey);
  const src = resolveArtworkSource(variant, cropKey);

  return (
    <div
      data-media-container
      className={cn(
        "relative min-h-20 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm sm:hidden",
        className,
      )}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="100vw"
        className={cn(
          "object-cover",
          resolvedTreatment,
          "opacity-10 saturate-[0.82] sm:opacity-20",
        )}
      />
      <div className={cn("absolute inset-0 bg-gradient-to-br", overlayByVariant[variant])} />
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}

function resolveArtworkSource(variant: PageArtworkVariant, cropKey?: string | number) {
  if (variant !== "tourCover") {
    return artworkByVariant[variant];
  }

  const index = (hashKey(cropKey ?? "tourCover") % 10) + 1;
  return `/assets/tour-covers/tour-cover-${String(index).padStart(2, "0")}.webp`;
}

function resolveImageTreatment(
  variant: PageArtworkVariant,
  crop?: PageArtworkCrop,
  cropKey?: string | number,
) {
  if (!crop) {
    return imageTreatmentByVariant[variant];
  }

  if (crop === "random") {
    return imageTreatmentByCrop[pickCrop(cropKey ?? variant)];
  }

  return imageTreatmentByCrop[crop];
}

function pickCrop(key: string | number) {
  return cropOptions[hashKey(key) % cropOptions.length];
}

function hashKey(key: string | number) {
  const text = String(key);
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function ShotTraceMotif({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative inline-block min-h-0 overflow-hidden rounded-md", className)}
      aria-hidden="true"
    >
      <Image
        src="/assets/page-shots-shot-trace.svg"
        alt=""
        fill
        sizes="120px"
        className="object-contain"
      />
    </span>
  );
}
