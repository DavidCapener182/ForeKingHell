import { MapPinned } from "lucide-react";

import type { HoleStrategy, HoleStrategyMode } from "@/lib/course-strategy";
import type { CourseStrategyMap, CourseStrategyMapPoint } from "@/lib/course-strategy-map";

import styles from "./course-strategy-book.module.css";

const VIEWBOX_WIDTH = 520;
const VIEWBOX_HEIGHT = 760;
const YARDS_TO_METRES = 0.9144;

export function HoleStrategyVisual({
  strategy,
  mode,
  courseMap = null,
  compact = false,
}: {
  strategy: HoleStrategy;
  mode: HoleStrategyMode;
  courseMap?: CourseStrategyMap | null;
  compact?: boolean;
}) {
  const mappedHole = courseMap?.holes.find((hole) => hole.holeNumber === strategy.holeNumber);
  const mapped = Boolean(courseMap && mappedHole);
  const left = compact ? (mode.evidence?.leftYd ?? 0) : (strategy.dispersionLeftYd ?? 8);
  const right = compact ? (mode.evidence?.rightYd ?? 0) : (strategy.dispersionRightYd ?? 8);
  const measuredDispersion =
    !compact ||
    (mode.evidence?.leftYd != null &&
      mode.evidence?.rightYd != null &&
      mode.evidence.carryRangeMeasured);
  if (compact && !mapped)
    return (
      <div className={styles.mobileMapUnavailable} role="status">
        <MapPinned aria-hidden />
        <p>Hole map unavailable</p>
        <span>
          Your measured club options are below. Confirm the target and hazards on the course.
        </span>
      </div>
    );

  return (
    <figure className={styles.visualFrame} data-compact={compact ? "true" : "false"}>
      <div className={styles.visualMeta}>
        <span>
          <MapPinned aria-hidden />{" "}
          {mapped
            ? compact && !courseMap?.imageUrl
              ? "Mapped hole plan"
              : "Mapped aerial plan"
            : "Illustrative fallback"}
        </span>
        <span>
          {mapped
            ? compact
              ? "Reference tee"
              : "Course Twin geometry · personal shot overlay"
            : `Hazard distance ${strategy.hazards.length ? "not mapped" : "unavailable"}`}
        </span>
      </div>
      <div className={styles.visualCanvas}>
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className={styles.holeVisual}
          role="img"
          aria-label={`${mapped ? "Mapped aerial" : "Illustrative"} plan for hole ${strategy.holeNumber}. ${mode.club} to ${mode.target}, carrying ${mode.carryRange}. ${measuredDispersion ? `Dispersion is ${left} yards left and ${right} yards right.` : "Measured dispersion unavailable."}`}
        >
          {courseMap && mappedHole ? (
            <MappedHolePlan
              courseMap={courseMap}
              hole={mappedHole}
              strategy={strategy}
              mode={mode}
              left={left}
              right={right}
              compact={compact}
              measuredDispersion={measuredDispersion}
            />
          ) : (
            <IllustrativeHolePlan strategy={strategy} mode={mode} left={left} right={right} />
          )}
        </svg>
      </div>
      <figcaption className={styles.visualLegend}>
        <span data-legend="target">{compact ? "Indicative target" : "Recommended landing"}</span>
        <span data-legend="dispersion">
          {measuredDispersion ? "Measured dispersion" : "Dispersion unavailable"}
        </span>
        <span data-legend="hazard">Mapped course</span>
      </figcaption>
    </figure>
  );
}

function MappedHolePlan({
  courseMap,
  hole,
  strategy,
  mode,
  left,
  right,
  compact,
  measuredDispersion,
}: {
  courseMap: CourseStrategyMap;
  hole: CourseStrategyMap["holes"][number];
  strategy: HoleStrategy;
  mode: HoleStrategyMode;
  left: number;
  right: number;
  compact: boolean;
  measuredDispersion: boolean;
}) {
  const projection = createHoleProjection(hole);
  const carryValues = rangeValues(mode.carryRange);
  const carryMidpoint =
    (compact ? mode.evidence?.carryYd : null) ??
    midpoint(mode.carryRange) ??
    strategy.personalCarryYd ??
    strategy.yards * 0.5;
  const landing = pointAlongPolyline(hole.centerline, carryMidpoint * YARDS_TO_METRES);
  const targetOffset = mode.target.toLowerCase().includes("left")
    ? -8
    : mode.target.toLowerCase().includes("right")
      ? 8
      : 0;
  const target = projection.project(landing.point);
  const tangentStart = projection.project(landing.segmentStart);
  const tangentEnd = projection.project(landing.segmentEnd);
  const tangentLength =
    Math.hypot(tangentEnd.x - tangentStart.x, tangentEnd.y - tangentStart.y) || 1;
  const rightVector = {
    x: -(tangentEnd.y - tangentStart.y) / tangentLength,
    y: (tangentEnd.x - tangentStart.x) / tangentLength,
  };
  if (compact) {
    target.x += rightVector.x * targetOffset * YARDS_TO_METRES * projection.scale;
    target.y += rightVector.y * targetOffset * YARDS_TO_METRES * projection.scale;
  } else target.x += targetOffset * projection.scale;

  const shotPoints = landing.path.map(projection.project);
  shotPoints[shotPoints.length - 1] = target;

  const dispersionRadiusX = clamp(
    ((left + right) * YARDS_TO_METRES * projection.scale) / 2,
    compact ? 0 : 24,
    compact ? Number.POSITIVE_INFINITY : 112,
  );
  const carrySpread = Math.max(
    compact ? 0 : 12,
    (carryValues.maximum - carryValues.minimum) * YARDS_TO_METRES,
  );
  const dispersionRadiusY = clamp(
    (carrySpread * projection.scale) / 2,
    compact ? 0 : 14,
    compact ? Number.POSITIVE_INFINITY : 48,
  );
  const lateralShift = ((right - left) * YARDS_TO_METRES * projection.scale) / 2;
  const dispersionCentreX = target.x + lateralShift * (compact ? rightVector.x : 1);
  const dispersionCentreY = target.y + (compact ? lateralShift * rightVector.y : 0);
  const dispersionAngle =
    (Math.atan2(tangentEnd.y - tangentStart.y, tangentEnd.x - tangentStart.x) * 180) / Math.PI + 90;
  const labelOnLeft = dispersionCentreX + dispersionRadiusX > 390;
  const labelX = labelOnLeft
    ? dispersionCentreX - dispersionRadiusX - 14
    : dispersionCentreX + dispersionRadiusX + 14;
  const tee = projection.project(hole.tee);
  const green = projection.project(hole.green);

  return (
    <>
      <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} rx="30" className={styles.mapGround} />
      <g transform={projection.matrix} aria-hidden>
        {courseMap.imageUrl ? (
          <image
            href={courseMap.imageUrl}
            x={courseMap.bounds.minX}
            y={courseMap.bounds.minZ}
            width={courseMap.bounds.maxX - courseMap.bounds.minX}
            height={courseMap.bounds.maxZ - courseMap.bounds.minZ}
            preserveAspectRatio="none"
            className={styles.mappedImagery}
          />
        ) : null}
        {courseMap.features.map((feature) =>
          feature.rings.map((ring, ringIndex) => (
            <path
              key={`${feature.id}-${ringIndex}`}
              d={ringPath(ring)}
              className={styles.mappedFeature}
              data-feature={feature.type}
            />
          )),
        )}
      </g>
      <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} className={styles.mappedShade} />
      <path d={screenPath(hole.centerline.map(projection.project))} className={styles.mappedLine} />
      <circle cx={green.x} cy={green.y} r="10" className={styles.mappedGreenMarker} />
      <circle cx={tee.x} cy={tee.y} r="8" className={styles.mappedTeeMarker} />
      {!compact || mode.evidence ? (
        <path d={screenPath(compact ? [tee, target] : shotPoints)} className={styles.shotLine} />
      ) : null}
      {measuredDispersion && (!compact || mode.evidence?.carryRangeMeasured) ? (
        <ellipse
          data-personal-dispersion
          cx={dispersionCentreX}
          cy={dispersionCentreY}
          rx={dispersionRadiusX}
          ry={dispersionRadiusY}
          transform={`rotate(${svgNumber(dispersionAngle)} ${dispersionCentreX} ${dispersionCentreY})`}
          className={styles.dispersion}
        />
      ) : null}
      {!compact || mode.evidence ? (
        <>
          <circle cx={target.x} cy={target.y} r="12" className={styles.landingTarget} />
          <circle cx={target.x} cy={target.y} r="3.5" className={styles.landingCentre} />
        </>
      ) : null}
      {!compact ? (
        <g className={styles.mappedRangeLabel} textAnchor={labelOnLeft ? "end" : "start"}>
          <text x={labelX} y={target.y - 4}>
            {mode.carryRange}
          </text>
          <text x={labelX} y={target.y + 16}>
            personal range
          </text>
        </g>
      ) : null}
    </>
  );
}

function IllustrativeHolePlan({
  strategy,
  mode,
  left,
  right,
}: {
  strategy: HoleStrategy;
  mode: HoleStrategyMode;
  left: number;
  right: number;
}) {
  const carry = midpoint(mode.carryRange) ?? strategy.personalCarryYd ?? strategy.yards * 0.5;
  const landingY = clamp(690 - (carry / Math.max(strategy.yards, 1)) * 570, 138, 565);
  const dispersionWidth = clamp((left + right) * 3.2, 72, 210);
  const targetX = mode.target.toLowerCase().includes("left")
    ? 228
    : mode.target.toLowerCase().includes("right")
      ? 292
      : 260;

  return (
    <>
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
    </>
  );
}

function createHoleProjection(hole: CourseStrategyMap["holes"][number]) {
  const tee = hole.tee;
  const green = hole.green;
  const directionX = green[0] - tee[0];
  const directionZ = green[1] - tee[1];
  const directionLength = Math.max(1, Math.hypot(directionX, directionZ));
  const unitX = directionX / directionLength;
  const unitZ = directionZ / directionLength;
  const perpendicularX = -unitZ;
  const perpendicularZ = unitX;
  const rotated = hole.centerline.map((point) => ({
    along: (point[0] - tee[0]) * unitX + (point[1] - tee[1]) * unitZ,
    across: (point[0] - tee[0]) * perpendicularX + (point[1] - tee[1]) * perpendicularZ,
  }));
  const alongValues = rotated.map((point) => point.along);
  const acrossValues = rotated.map((point) => point.across);
  const minAlong = Math.min(...alongValues);
  const maxAlong = Math.max(...alongValues);
  const minAcross = Math.min(...acrossValues);
  const maxAcross = Math.max(...acrossValues);
  const scale = svgNumber(
    Math.min(
      640 / Math.max(120, maxAlong - minAlong + 36),
      390 / Math.max(90, maxAcross - minAcross + 72),
    ),
  );
  const offsetX = VIEWBOX_WIDTH / 2 - ((minAcross + maxAcross) / 2) * scale;
  const offsetY = VIEWBOX_HEIGHT / 2 + ((minAlong + maxAlong) / 2) * scale;
  const matrixA = scale * perpendicularX;
  const matrixB = -scale * unitX;
  const matrixC = scale * perpendicularZ;
  const matrixD = -scale * unitZ;
  const matrixE = offsetX - scale * (perpendicularX * tee[0] + perpendicularZ * tee[1]);
  const matrixF = offsetY + scale * (unitX * tee[0] + unitZ * tee[1]);

  return {
    scale,
    matrix: `matrix(${[matrixA, matrixB, matrixC, matrixD, matrixE, matrixF].map(svgNumber).join(" ")})`,
    project: (point: CourseStrategyMapPoint) => ({
      x: svgNumber(
        offsetX +
          ((point[0] - tee[0]) * perpendicularX + (point[1] - tee[1]) * perpendicularZ) * scale,
      ),
      y: svgNumber(offsetY - ((point[0] - tee[0]) * unitX + (point[1] - tee[1]) * unitZ) * scale),
    }),
  };
}

function pointAlongPolyline(points: CourseStrategyMapPoint[], distanceM: number) {
  const path = [points[0] ?? ([0, 0] as CourseStrategyMapPoint)];
  let remaining = Math.max(0, distanceM);

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (remaining <= segmentLength) {
      const ratio = segmentLength > 0 ? remaining / segmentLength : 0;
      const point: CourseStrategyMapPoint = [
        start[0] + (end[0] - start[0]) * ratio,
        start[1] + (end[1] - start[1]) * ratio,
      ];
      return { point, path: [...path, point], segmentStart: start, segmentEnd: end };
    }
    remaining -= segmentLength;
    path.push(end);
  }

  const end = points.at(-1) ?? path[0]!;
  const start = points.at(-2) ?? end;
  return { point: end, path, segmentStart: start, segmentEnd: end };
}

function ringPath(points: CourseStrategyMapPoint[]) {
  if (points.length === 0) return "";
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"}${point[0]} ${point[1]}`).join(" ")} Z`;
}

function screenPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
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

function rangeValues(range: string) {
  const values = range.match(/\d+/g)?.map(Number) ?? [];
  const minimum = values[0] ?? 0;
  return { minimum, maximum: values[1] ?? minimum };
}

function midpoint(range: string) {
  const { minimum, maximum } = rangeValues(range);
  if (minimum === 0 && maximum === 0) return null;
  return (minimum + maximum) / 2;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

// Stable SVG serialization across V8 and WebKit; sub-pixel rounding only.
function svgNumber(value: number) {
  return Number(value.toFixed(4));
}
