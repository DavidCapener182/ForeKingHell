import { createRoot } from "react-dom/client";

import { TodayShotCharts, type TodayChartShot } from "@/app/today/today-shot-charts";
import { MobileShotPatternCharts } from "@/components/app/mobile-shot-pattern-charts";
import type { ShotPatternPoint } from "@/lib/shot-pattern-chart-data";

const options = new URLSearchParams(window.location.search);
const wide = options.get("wide") === "1";
const shots: TodayChartShot[] = [
  ...[-19.4, -10, -7, -3, 0, 4, 8, 13, 19.4].map((side, index) => ({
    id: `driver-${index + 1}`,
    clubType: "driver",
    clubLabel: "Driver",
    shotNumber: index + 1,
    carryYd: 192 + index,
    totalYd: 205 + index,
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
const points: ShotPatternPoint[] = shots.map((shot) => ({
  ...shot,
  shotAt: "2026-09-08T10:00:00Z",
  trusted: shot.id !== "iron-9",
}));

createRoot(document.getElementById("root")!).render(
  <main className="w-full min-w-0 p-3 sm:p-6">
    {options.get("surface") === "companion" ? (
      <MobileShotPatternCharts points={points} defaultToAllClubs />
    ) : (
      <TodayShotCharts shots={shots} variant="editorial" />
    )}
  </main>,
);
