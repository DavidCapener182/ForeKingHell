import { createRoot } from "react-dom/client";
import { DistanceBenchmarkPanel } from "../../../src/app/bag/distance-benchmark-panel";
import { ClubPerformanceIntelligence } from "../../../src/app/bag/club-performance-intelligence";
import { ClubDetailClient } from "../../../src/app/bag/[clubId]/club-detail-client";
import type { AnalysisShot } from "../../../src/app/bag/[clubId]/club-analysis-tabs";
import { buildClubBenchmarkRows } from "../../../src/lib/club-benchmarks";
import {
  buildPerformanceIntelligence,
  type PerformanceShot,
} from "../../../src/lib/performance-intelligence";

// SYNTHETIC ACCEPTANCE FIXTURE. Never imported, stored or shown as a player's real data.
const shots: PerformanceShot[] = [];
for (const [clubId, source, settingsKey, potential, stock] of [
  ["fixture-driver", "Synthetic monitor A", "raw", 220, 180],
  ["fixture-driver", "Synthetic monitor B", "normalized", 240, 200],
  ["fixture-iron", "Synthetic monitor A", "raw", 155, 145],
] as const) {
  for (let index = 0; index < 30; index++)
    shots.push({
      id: `${clubId}-${source}-potential-${index}`,
      clubId,
      source,
      settingsKey,
      equipmentId: clubId,
      ballType: "fixture ball",
      environment: "outdoor range",
      normalization: settingsKey,
      sessionId: `${clubId}-${source}-historical`,
      shotAt: "2025-12-01T12:00:00Z",
      carryYd: potential,
      shotCategory: "full",
    });
  for (let session = 1; session <= 6; session++) {
    for (let index = 0; index < 12; index++)
      shots.push({
        id: `${clubId}-${source}-${session}-${index}`,
        clubId,
        source,
        settingsKey,
        equipmentId: clubId,
        ballType: "fixture ball",
        environment: "outdoor range",
        normalization: settingsKey,
        sessionId: `${clubId}-${source}-session-${session}`,
        shotAt: `2026-10-${String(session + 1).padStart(2, "0")}T12:00:00Z`,
        carryYd: index === 11 ? 40 : stock + index - 5,
        sideCarryYd: index % 2 ? 12 : -12,
        ballSpeedMph: 125 + index,
        clubSpeedMph: 90,
        shotCategory: "full",
        qualityTag: index === 11 ? "severe-mishit" : null,
      });
  }
}
const intelligence = buildPerformanceIntelligence(shots, {
  asOf: new Date("2026-10-18T12:00:00Z"),
});
const selected = Array.from({ length: 30 }, (_, index) => `synthetic-best-${index}`);
const rows = buildClubBenchmarkRows([
  {
    clubId: "fixture-driver",
    clubType: "driver",
    brandModel: "Synthetic Driver",
    carryYd: 220,
    sampleSize: 30,
    confidenceScore: 80,
    eligibleCount: 100,
    savedShotCount: 102,
    selectedShotIds: selected,
    metrics: {
      carryYd: 220,
      clubSpeedMph: 91.1,
      ballSpeedMph: 135,
      smashFactor: 1.48,
      maxHeightYd: 32.8,
      landAngleDeg: 41.4,
    },
    metricEvidence: {
      clubSpeedMph: {
        validCount: 18,
        selectedCount: 30,
        measuredCount: 12,
        estimatedCount: 6,
        excludedNumericCount: 12,
        shotIds: selected.slice(0, 18),
        method: "Synthetic measured values on carry-selected shots",
      },
    },
  },
  {
    clubId: "fixture-iron",
    clubType: "7i",
    brandModel: "Synthetic 7 iron",
    carryYd: 155,
    sampleSize: 12,
    confidenceScore: 40,
    eligibleCount: 12,
    savedShotCount: 12,
    metrics: { carryYd: 155 },
    metricEvidence: {
      maxHeightYd: {
        validCount: 0,
        selectedCount: 12,
        excludedNumericCount: 12,
        shotIds: [],
        method: "Synthetic stored height with unresolved source units",
      },
    },
  },
]);
const labels = { "fixture-driver": "Driver", "fixture-iron": "7 iron" };
const analysisShots: AnalysisShot[] = shots
  .filter((shot) => shot.clubId === "fixture-driver")
  .map((shot, index) => ({
    id: shot.id,
    sessionId: shot.sessionId ?? undefined,
    sessionTitle: shot.sessionId,
    shotNumber: index + 1,
    shotAt: new Date(shot.shotAt).toISOString(),
    carryYd: shot.carryYd,
    totalYd: null,
    sideCarryYd: shot.sideCarryYd ?? null,
    ballSpeedMph: shot.ballSpeedMph ?? null,
    clubSpeedMph: shot.clubSpeedMph ?? null,
    launchAngleDeg: null,
    launchDirectionDeg: null,
    apexFt: null,
    attackAngleDeg: null,
    clubPathDeg: null,
    faceAngleDeg: null,
    descentAngleDeg: null,
    smashFactor: null,
    spinRate: null,
    spinAxis: null,
    reviewStatus: "included",
    shotCategory: "full",
    qualityTag: shot.qualityTag ?? null,
    courseHoleNumber: null,
    sessionType: "range",
    clubDataEstType: null,
  }));
createRoot(document.getElementById("root")!).render(
  location.pathname.endsWith("/club") ? (
    <main className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-4">
      <aside className="rounded-lg border bg-muted p-3 font-semibold">
        SYNTHETIC SELECTED-CLUB CONTEXT FIXTURE — no player data or server actions
      </aside>
      <ClubDetailClient
        club={{
          id: "fixture-driver",
          type: "driver",
          brand: "Synthetic",
          model: "Driver",
          shots: analysisShots,
        }}
        intelligence={intelligence}
      />
    </main>
  ) : (
    <main className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-4">
      <aside className="rounded-lg border border-border bg-muted p-3 text-sm font-semibold">
        SYNTHETIC ACCEPTANCE FIXTURE — demonstration data only; not David’s performance
      </aside>
      <h1 className="text-xl font-semibold">Benchmark and performance intelligence</h1>
      <DistanceBenchmarkPanel
        rows={rows}
        peerSummary={{
          cohortLabel: "Unavailable synthetic peer context",
          peerUserCount: 0,
          peerShotCount: 0,
          comparisons: [],
        }}
        peerBenchmarksLoaded={false}
        intelligence={intelligence}
        clubLabels={labels}
        clubTypes={{ "fixture-driver": "driver", "fixture-iron": "7i" }}
      />
      <details>
        <summary>Selected-club fixture</summary>
        <ClubPerformanceIntelligence
          intelligence={{
            ...intelligence,
            groups: intelligence.groups.filter((group) => group.clubId === "fixture-driver"),
          }}
          clubType="driver"
          clubLabels={labels}
        />
      </details>
    </main>
  ),
);
