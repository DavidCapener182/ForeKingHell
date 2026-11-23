import { createRoot } from "react-dom/client";

import {
  SharedShotPatternVisual,
  TodayShotCharts,
  type TodayChartShot,
} from "@/app/today/today-shot-charts";
import { MobileShotPatternCharts } from "@/components/app/mobile-shot-pattern-charts";
import type { ShotPatternPoint } from "@/lib/shot-pattern-chart-data";

const options = new URLSearchParams(window.location.search);
const wide = options.get("wide") === "1";
const longestCarry = options.get("carry") === "224" ? 224 : 234;
const shots: TodayChartShot[] = [
  ...[-19.4, -10, -7, -3, 0, 4, 8, 13, 19.4].map((side, index) => ({
    id: `driver-${index + 1}`,
    clubType: "driver",
    clubLabel: "Driver",
    shotNumber: index + 1,
    carryYd: longestCarry - 8 + index,
    totalYd: longestCarry + 5 + index,
    sideCarryYd: side,
    launchDirectionDeg: side / 4,
    apexFt: 50 + index,
    launchAngleDeg: 12,
    ballSpeedMph: 130,
  })),
  ...[-5, -4, -2, 0, 1, 2, 3, 4, wide ? 80 : 30].map((side, index) => ({
    id: `iron-${index + 1}`,
    clubType: "7i",
    clubLabel: "7 iron",
    shotNumber: index + 10,
    carryYd: 142 + index,
    totalYd: 150 + index,
    sideCarryYd: side,
    launchDirectionDeg: side / 8,
    apexFt: 72 + index,
    launchAngleDeg: 18,
    ballSpeedMph: 105,
  })),
];
if (options.get("selection") === "1") {
  for (const index of [7, 8]) {
    const shot = shots[index];
    shot.detail = {
      id: shot.id,
      sessionId: "fixture",
      shotAtLabel: "Fixture day",
      fileNameLabel: "Fixture only",
      shotNumberLabel: String(shot.shotNumber),
      holeLabel: "—",
      clubLabel: shot.clubLabel,
      clubTypeLabel: shot.clubLabel,
      clubType: shot.clubType,
      shotCategoryLabel: "Measured",
      carryLabel: String(shot.carryYd),
      totalLabel: String(shot.totalYd),
      sideLabel: String(shot.sideCarryYd),
      launchLabel: String(shot.launchAngleDeg),
      ballSpeedLabel: String(shot.ballSpeedMph),
      clubSpeedLabel: "—",
      launchDirectionLabel: "—",
      apexLabel: String(shot.apexFt),
      attackLabel: "—",
      pathLabel: "—",
      faceLabel: "—",
      descentLabel: "—",
      smashLabel: "—",
      spinRateLabel: "—",
      spinAxisLabel: "—",
      estimateLabel: "Measured",
      shotShapeLabel: "—",
      qualityTagLabel: "—",
      reviewStatus: "included",
      reviewStatusLabel: "Included",
      reviewReason: null,
      reviewConfidenceLabel: "—",
      reviewSourceLabel: "—",
      reviewedAtLabel: "—",
      reviewEvents: [],
      evidenceStatus: "trusted",
      evidenceReasons: [],
      sideTone: "slate",
      carryYd: shot.carryYd,
      sideCarryYd: shot.sideCarryYd,
      apexFt: shot.apexFt,
      sourceEntries: [],
      canDeletePermanently: index === 8,
    };
  }
}
const points: ShotPatternPoint[] = shots.map((shot) => ({
  ...shot,
  shotAt: "2026-09-08T10:00:00Z",
  trusted: shot.id !== "iron-9",
}));
points.push({
  ...points[0],
  id: "total-only",
  shotNumber: 99,
  carryYd: null,
  totalYd: 640,
  sideCarryYd: 80,
});

createRoot(document.getElementById("root")!).render(
  <main className="w-full min-w-0 p-3 sm:p-6">
    {options.get("surface") === "companion" ? (
      <MobileShotPatternCharts points={points} defaultToAllClubs />
    ) : options.get("surface") === "thumbnails" ? (
      <section
        className="grid w-[640px] max-w-full grid-cols-2 gap-2"
        aria-label="Measured shot thumbnails"
      >
        {(["dispersion", "trajectory"] as const).map((mode) => (
          <figure key={mode} className="min-w-0 overflow-hidden rounded-xl border bg-muted/20 p-2">
            <figcaption className="mb-2 text-xs font-semibold">
              {mode === "dispersion" ? "Dispersion" : "Flight"}
            </figcaption>
            <div className="overflow-hidden rounded-lg bg-white">
              <SharedShotPatternVisual shots={shots} mode={mode} trajectoryView="averages" />
            </div>
          </figure>
        ))}
      </section>
    ) : (
      <TodayShotCharts shots={shots} variant="editorial" />
    )}
  </main>,
);
