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
  | "strokesGained"
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
  equipment: "/assets/generated/equipment-bag-hero-v2.png",
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
  strokesGained: "/assets/generated/strokes-gained-hole-tracers.png",
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
  equipment: "from-white/70 via-white/24 to-slate-950/8",
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
  strokesGained: "from-white/55 via-sky-50/15 to-emerald-950/10",
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
      {isInlineArtworkVariant(variant) ? (
        <InlinePageArtwork variant={variant} className={cn("absolute inset-0", imageClassName)} />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          loading={priority ? "eager" : "lazy"}
          sizes={sizes}
          className={cn(
            "object-cover opacity-80 saturate-[0.92]",
            resolvedTreatment,
            imageClassName,
          )}
        />
      )}
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
      {isInlineArtworkVariant(variant) ? (
        <InlinePageArtwork variant={variant} className="absolute inset-0 opacity-40" />
      ) : (
        <Image
          src={src}
          alt=""
          fill
          sizes="calc(100vw - 2rem)"
          className={cn(
            "object-cover",
            resolvedTreatment,
            "opacity-10 saturate-[0.82] sm:opacity-20",
          )}
        />
      )}
      <div className={cn("absolute inset-0 bg-gradient-to-br", overlayByVariant[variant])} />
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}

function isInlineArtworkVariant(variant: PageArtworkVariant) {
  return variant === "progress" || variant === "stockYardages";
}

function InlinePageArtwork({
  variant,
  className,
}: {
  variant: PageArtworkVariant;
  className?: string;
}) {
  if (variant === "progress") {
    return (
      <svg viewBox="0 0 1600 900" className={cn("h-full w-full", className)} aria-hidden="true">
        <rect width="1600" height="900" fill="#EFF7F0" />
        <rect x="86" y="100" width="1428" height="700" rx="60" fill="#F8FCF8" stroke="#D6E7D8" strokeWidth="10" />
        <path d="M148 664C260 612 404 578 581 563C735 548 859 506 954 436C1049 366 1137 284 1219 190" stroke="#0B7A3B" strokeWidth="32" strokeLinecap="round" fill="none" />
        <path d="M1230 194L1204 245L1272 233" stroke="#0B7A3B" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="202" y="212" width="238" height="120" rx="30" fill="#E8F7EE" />
        <rect x="476" y="274" width="238" height="120" rx="30" fill="#DBF0FF" />
        <rect x="760" y="224" width="238" height="120" rx="30" fill="#FEF3C7" />
        <rect x="1038" y="156" width="266" height="144" rx="34" fill="#FFFFFF" stroke="#CFE7D6" strokeWidth="8" />
        <text x="321" y="284" fill="#0B7A3B" fontSize="52" fontWeight="700" textAnchor="middle">
          Trust
        </text>
        <text x="595" y="346" fill="#0369A1" fontSize="52" fontWeight="700" textAnchor="middle">
          Carry
        </text>
        <text x="879" y="296" fill="#B45309" fontSize="52" fontWeight="700" textAnchor="middle">
          Strike
        </text>
        <text x="1170" y="218" fill="#111827" fontSize="38" fontWeight="700" textAnchor="middle">
          Improving
        </text>
        <text x="1170" y="266" fill="#4B5563" fontSize="34" fontWeight="600" textAnchor="middle">
          but uneven
        </text>
        <g opacity="0.94">
          <circle cx="340" cy="646" r="18" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="6" />
          <circle cx="653" cy="568" r="18" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="6" />
          <circle cx="934" cy="439" r="18" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="6" />
          <circle cx="1206" cy="214" r="18" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="6" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 1600 900" className={cn("h-full w-full", className)} aria-hidden="true">
      <rect width="1600" height="900" fill="#F5F8EF" />
      <path d="M0 770C154 690 341 648 560 644C781 640 989 670 1184 736C1320 782 1458 804 1600 800V900H0Z" fill="#B9DB8F" />
      <path d="M0 702C195 610 419 566 673 568C905 571 1112 622 1295 720C1390 770 1492 801 1600 812V900H0Z" fill="#8FC86F" opacity="0.94" />
      <circle cx="1130" cy="370" r="176" fill="#FCFEFA" stroke="#D6E7D8" strokeWidth="14" />
      <circle cx="1130" cy="370" r="124" fill="none" stroke="#C7D7C8" strokeWidth="10" />
      <circle cx="1130" cy="370" r="72" fill="none" stroke="#A7BBA9" strokeWidth="10" />
      <circle cx="1130" cy="370" r="18" fill="#0B7A3B" />
      <rect x="162" y="174" width="262" height="150" rx="30" fill="#FFFFFF" stroke="#D7E3D8" strokeWidth="8" />
      <rect x="204" y="228" width="150" height="18" rx="9" fill="#0B7A3B" opacity="0.88" />
      <rect x="204" y="266" width="92" height="18" rx="9" fill="#94A3B8" opacity="0.72" />
      <text x="294" y="215" fill="#111827" fontSize="38" fontWeight="700" textAnchor="middle">
        Stock
      </text>
      <path d="M470 662C610 585 748 523 886 474" stroke="#111827" strokeWidth="18" strokeLinecap="round" fill="none" opacity="0.78" />
      <path d="M855 447L908 468L871 510" stroke="#111827" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.78" />
      <circle cx="470" cy="662" r="16" fill="#FFFFFF" stroke="#111827" strokeWidth="6" />
      <circle cx="886" cy="474" r="16" fill="#FFFFFF" stroke="#0B7A3B" strokeWidth="6" />
      <text x="1028" y="164" fill="#111827" fontSize="54" fontWeight="700">
        Yardage windows
      </text>
      <text x="1028" y="228" fill="#4B5563" fontSize="34" fontWeight="600">
        carry, play number, target fit
      </text>
    </svg>
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
