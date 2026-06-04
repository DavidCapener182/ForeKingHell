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
  showGroundLine = true,
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
  showGroundLine?: boolean;
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
        <ClubFallbackArtwork
          clubType={clubType}
          view={view}
          className={cn("absolute inset-0", imageClassName)}
        />
      )}
      {showGroundLine ? (
        <div className="absolute inset-x-4 bottom-3 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />
      ) : null}
    </div>
  );
}

function ClubFallbackArtwork({
  clubType,
  view,
  className,
}: {
  clubType: string | null | undefined;
  view: ClubArtworkView;
  className?: string;
}) {
  const normalized = (clubType ?? "").trim().toLowerCase();
  const spec = resolveFallbackSpec(normalized);

  return (
    <svg viewBox="0 0 640 360" className={cn("h-full w-full", className)} aria-hidden="true">
      <rect width="640" height="360" rx="32" fill="#EEF4F8" />
      <rect x="30" y="270" width="580" height="3" rx="1.5" fill="#CBD5E1" opacity="0.6" />
      <path
        d={view === "top" ? spec.topShaft : spec.sideShaft}
        stroke="#475569"
        strokeWidth={view === "top" ? 12 : 10}
        strokeLinecap="round"
        fill="none"
      />
      <path d={view === "top" ? spec.topHead : spec.sideHead} fill={spec.headFill} />
      {view === "top" ? (
        <path
          d={spec.topAccent}
          stroke={spec.accent}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
      {view === "side" ? (
        <path
          d={spec.sideAccent}
          stroke={spec.accent}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
      <circle cx="112" cy="248" r="20" fill="#273449" />
      <circle cx="112" cy="248" r="8" fill="#64748B" />
      <rect x="36" y="36" width="146" height="42" rx="21" fill={spec.badgeFill} />
      <text x="109" y="63" fill="#0F172A" fontSize="28" fontWeight="700" textAnchor="middle">
        {spec.label}
      </text>
      <text x="505" y="312" fill="#64748B" fontSize="28" fontWeight="600" textAnchor="end">
        {spec.family}
      </text>
    </svg>
  );
}

function resolveFallbackSpec(clubType: string) {
  if (clubType.includes("driver")) {
    return {
      label: "DR",
      family: "Driver",
      badgeFill: "#D6EAF8",
      headFill: "#111827",
      accent: "#64748B",
      sideShaft: "M112 248C168 227 255 192 372 148C454 117 515 95 556 84",
      sideHead: "M520 58C553 42 591 40 617 63C604 97 579 118 548 125L497 118L520 58Z",
      sideAccent: "M535 73C564 65 587 69 602 86",
      topShaft: "M112 248C208 235 306 221 408 205C482 193 538 183 575 174",
      topHead:
        "M495 144C542 129 586 132 620 169C599 204 563 224 512 225C494 209 486 191 489 171L495 144Z",
      topAccent: "M519 164C551 157 578 162 596 181",
    };
  }

  if (/^[1-9]w$/.test(clubType) || clubType.includes("wood")) {
    return {
      label: "FW",
      family: "Fairway wood",
      badgeFill: "#DBEAFE",
      headFill: "#1E293B",
      accent: "#60A5FA",
      sideShaft: "M112 248C175 226 270 190 396 141C463 115 516 95 556 82",
      sideHead: "M518 64C545 51 577 49 602 66C591 95 569 114 541 124L498 121L518 64Z",
      sideAccent: "M530 80C555 72 576 75 591 88",
      topShaft: "M112 248C201 236 297 221 400 204C468 193 522 184 564 175",
      topHead:
        "M500 149C544 138 583 142 611 172C592 201 557 219 511 217C496 202 490 187 491 170L500 149Z",
      topAccent: "M520 165C549 159 573 164 589 180",
    };
  }

  if (clubType.includes("hybrid")) {
    return {
      label: "HY",
      family: "Hybrid",
      badgeFill: "#E0F2FE",
      headFill: "#1F2937",
      accent: "#06B6D4",
      sideShaft: "M112 248C177 225 264 191 375 151C445 126 497 107 533 96",
      sideHead: "M492 82C522 71 553 73 577 91C569 116 548 133 519 143L478 140L492 82Z",
      sideAccent: "M502 97C527 89 548 92 562 103",
      topShaft: "M112 248C194 237 281 222 376 206C437 196 489 189 532 183",
      topHead: "M474 158C512 149 548 154 576 180C561 204 529 218 485 215C472 201 468 186 474 158Z",
      topAccent: "M491 172C516 166 537 170 551 184",
    };
  }

  if (["gw", "aw", "sw", "lw"].includes(clubType) || clubType.includes("wedge")) {
    const isGap = clubType.includes("gap") || clubType === "gw" || clubType === "aw";
    const isLob = clubType.includes("lob") || clubType === "lw";

    return {
      label: isGap ? "GW" : isLob ? "LW" : "SW",
      family: isGap ? "Gap wedge" : isLob ? "Lob wedge" : "Sand wedge",
      badgeFill: isGap ? "#FEF3C7" : isLob ? "#FDE7F3" : "#DCFCE7",
      headFill: isGap ? "#A16207" : isLob ? "#BE185D" : "#15803D",
      accent: isGap ? "#F59E0B" : isLob ? "#EC4899" : "#22C55E",
      sideShaft: "M112 248C175 221 249 184 334 137C387 108 425 87 450 74",
      sideHead: "M426 72L497 102L466 148L406 118Z",
      sideAccent: "M421 98C440 110 454 122 463 136",
      topShaft: "M112 248C178 232 246 210 315 182C362 162 401 143 434 126",
      topHead: "M405 112L492 147L470 194L390 164Z",
      topAccent: "M411 138C432 147 447 160 456 177",
    };
  }

  return {
    label: "IR",
    family: "Iron",
    badgeFill: "#E2E8F0",
    headFill: "#334155",
    accent: "#94A3B8",
    sideShaft: "M112 248C177 220 261 176 365 117C413 89 449 67 474 51",
    sideHead: "M444 50L501 78L470 144L418 122Z",
    sideAccent: "M441 83C453 95 463 109 470 124",
    topShaft: "M112 248C180 226 255 196 336 157C385 133 427 112 462 96",
    topHead: "M431 87L509 120L487 170L411 139Z",
    topAccent: "M435 114C452 124 464 138 473 154",
  };
}
