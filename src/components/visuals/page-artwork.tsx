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
  coach: greenComplexArtwork,
  equipment: "/assets/clubs/panel/driver-side.png",
  achievements: greenComplexArtwork,
  import: greenComplexArtwork,
  progress: "/assets/page-progress.png",
  rounds: "/assets/page-rounds.png",
  stockYardages: "/assets/page-stock-yardages.png",
};

const cropOptions = ["green", "fairway", "tee"] as const;

const imageTreatmentByCrop: Record<(typeof cropOptions)[number], string> = {
  green: "origin-top object-[50%_0%] opacity-90 saturate-[1.08] brightness-[0.98] scale-[1.65]",
  fairway: "origin-center object-[50%_50%] opacity-90 saturate-[1.08] brightness-[0.98] scale-[1.45]",
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

  return (
    <div
      className={cn(
        "pointer-events-none relative hidden min-h-40 overflow-hidden rounded-2xl border border-white/60 bg-white/35 shadow-sm md:block",
        className,
      )}
      aria-hidden={alt === ""}
    >
      <Image
        src={artworkByVariant[variant]}
        alt={alt}
        fill
        priority={priority}
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

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/70 bg-white/70 p-3 shadow-sm sm:hidden",
        className,
      )}
    >
      <Image
        src={artworkByVariant[variant]}
        alt=""
        fill
        sizes="100vw"
        className={cn("object-cover", resolvedTreatment, "opacity-20 saturate-[0.9]")}
      />
      <div className={cn("absolute inset-0 bg-gradient-to-br", overlayByVariant[variant])} />
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
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
  const text = String(key);
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % cropOptions.length;
  }

  return cropOptions[hash];
}

export function ShotTraceMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 86" className={className} aria-hidden="true">
      <path
        d="M10 70 C48 34 92 22 160 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="7 8"
        opacity="0.75"
      />
      <path
        d="M20 72 C56 56 104 54 170 66"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.12"
      />
      <circle cx="162" cy="18" r="5" fill="currentColor" opacity="0.9" />
      <circle cx="124" cy="26" r="3" fill="currentColor" opacity="0.45" />
      <circle cx="84" cy="39" r="2.5" fill="currentColor" opacity="0.32" />
    </svg>
  );
}
