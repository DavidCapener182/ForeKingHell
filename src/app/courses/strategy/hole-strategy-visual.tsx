import { MapPinned } from "lucide-react";

import type { HoleStrategy, HoleStrategyMode } from "@/lib/course-strategy";

import styles from "./course-strategy-book.module.css";

export function HoleStrategyVisual({
  strategy,
  mode,
  compact = false,
}: {
  strategy: HoleStrategy;
  mode: HoleStrategyMode;
  compact?: boolean;
}) {
  const carry = midpoint(mode.carryRange) ?? strategy.personalCarryYd ?? strategy.yards * 0.5;
  const landingY = clamp(690 - (carry / Math.max(strategy.yards, 1)) * 570, 138, 565);
  const left = strategy.dispersionLeftYd ?? 8;
  const right = strategy.dispersionRightYd ?? 8;
  const dispersionWidth = clamp((left + right) * 3.2, 72, 210);
  const targetX = mode.target.toLowerCase().includes("left")
    ? 228
    : mode.target.toLowerCase().includes("right")
      ? 292
      : 260;

  return (
    <figure className={styles.visualFrame} data-compact={compact ? "true" : "false"}>
      <div className={styles.visualMeta}>
        <span>
          <MapPinned aria-hidden /> Illustrative plan
        </span>
        <span>Hazard distance {strategy.hazards.length ? "not mapped" : "unavailable"}</span>
      </div>
      <svg
        viewBox="0 0 520 760"
        className={styles.holeVisual}
        role="img"
        aria-label={`Illustrative plan for hole ${strategy.holeNumber}. ${mode.club} to ${mode.target}, carrying ${mode.carryRange}. Dispersion is ${left} yards left and ${right} yards right. Hazard distances are not surveyed in this strategy view.`}
      >
        <rect width="520" height="760" rx="30" className={styles.mapGround} />
        <g className={styles.contours} aria-hidden>
          <path d="M30 170 C120 105 205 155 278 122 S440 92 495 138" />
          <path d="M18 286 C104 228 186 270 272 235 S432 211 506 258" />
          <path d="M28 414 C108 370 184 405 265 370 S430 353 498 392" />
          <path d="M18 548 C98 500 188 530 270 498 S432 489 508 528" />
          <path d="M30 666 C122 616 199 650 280 622 S433 615 494 650" />
        </g>

        <path
          d="M232 704 C194 642 188 586 206 526 C222 471 206 414 196 358 C183 286 194 220 224 164 C238 137 239 114 230 91 C250 75 273 75 292 91 C281 118 284 143 300 168 C333 220 344 286 328 358 C315 416 300 470 317 529 C334 588 325 644 288 704 Z"
          className={styles.fairway}
        />
        <ellipse cx="260" cy="84" rx="58" ry="34" className={styles.green} />
        <path d="M260 82 L260 46" className={styles.flagStick} />
        <path d="M260 47 L292 57 L260 67 Z" className={styles.flag} />
        <rect x="226" y="700" width="68" height="20" rx="8" className={styles.teeBox} />

        {strategy.hazards.slice(0, 3).map((hazard, index) => (
          <HazardMark key={`${hazard}-${index}`} hazard={hazard} index={index} />
        ))}

        <path
          d={`M260 700 C260 610 ${targetX} ${landingY + 80} ${targetX} ${landingY}`}
          className={styles.shotLine}
        />
        <ellipse
          cx={targetX}
          cy={landingY}
          rx={dispersionWidth / 2}
          ry={clamp(dispersionWidth * 0.7, 56, 130)}
          className={styles.dispersion}
        />
        <circle cx={targetX} cy={landingY} r="12" className={styles.landingTarget} />
        <circle cx={targetX} cy={landingY} r="3.5" className={styles.landingCentre} />

        <g className={styles.rangeBracket} aria-hidden>
          <path
            d={`M${targetX + 82} ${landingY - 55} h18 M${targetX + 91} ${landingY - 55} v110 M${targetX + 82} ${landingY + 55} h18`}
          />
          <text x={targetX + 106} y={landingY - 5}>
            {mode.carryRange}
          </text>
          <text x={targetX + 106} y={landingY + 14}>
            personal range
          </text>
        </g>
      </svg>
      <figcaption className={styles.visualLegend}>
        <span data-legend="target">Recommended landing</span>
        <span data-legend="dispersion">Measured dispersion</span>
        <span data-legend="hazard">Mapped hazard</span>
      </figcaption>
    </figure>
  );
}

function HazardMark({ hazard, index }: { hazard: string; index: number }) {
  const left = index % 2 === 0;
  const x = left ? 164 - index * 8 : 356 + index * 6;
  const y = 255 + index * 118;
  const normalized = hazard.toLowerCase();

  if (normalized.includes("water")) {
    return <path d={`M${x - 45} ${y} q45 -36 90 0 q-45 40 -90 0Z`} className={styles.water} />;
  }
  if (normalized.includes("bunker") || normalized.includes("sand")) {
    return <ellipse cx={x} cy={y} rx="38" ry="20" className={styles.bunker} />;
  }
  return (
    <g className={styles.genericHazard}>
      <circle cx={x} cy={y} r="21" />
      <text x={x} y={y + 5} textAnchor="middle">
        !
      </text>
    </g>
  );
}

function midpoint(range: string) {
  const values = range.match(/\d+/g)?.map(Number) ?? [];
  if (values.length < 2) return values[0] ?? null;
  return (values[0]! + values[1]!) / 2;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
