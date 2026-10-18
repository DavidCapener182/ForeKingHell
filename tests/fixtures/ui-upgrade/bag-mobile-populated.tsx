import { mobileQuickBagClub } from "../../../src/lib/mobile-quick-bag-evidence";
import { buildPerformanceIntelligence } from "../../../src/lib/performance-intelligence";
import { calculateShortGameTouchSummary } from "../../../src/lib/short-game";
import { WorkbenchAppShell } from "../../../src/components/app/workbench-app-shell";
import { CompanionAppShell } from "../../../src/components/app/companion-app-shell";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { createRoot } from "react-dom/client";
// @ts-expect-error virtual fixture module supplied by esbuild
import { BagMobilePage } from "bag-page-mobile-sections";
import { calculateStockYardage } from "../../../src/lib/stock-yardage";

import { buildClubBenchmarkRows } from "../../../src/lib/club-benchmarks";

// SYNTHETIC POPULATED BAG, never stored or presented as David's data.
const types = ["driver", "3w", "5w", "4h", "5i", "6i", "7i", "8i", "9i", "pw", "gw", "sw", "lw"];
const clubs = types.map((type, index) => {
  const carry = 225 - index * 13;
  const shots = Array.from({ length: 40 }, (_, i) => ({
    id: `${type}-${i}`,
    carryYd: carry + (i % 9) - 4,
    totalYd: carry + 10 + (i % 9),
    sideCarryYd: (i % 7) - 3,
    shotCategory: "full",
    shotAt: new Date("2026-10-17"),
    sessionId: "synthetic-session",
  }));
  return {
    id: `fixture-${type}`,
    userId: "synthetic-owner",
    brand: "Synthetic",
    model: "Custom equipment with a long model description",
    accent: "emerald",
    isShortGameTouch: false,
    decisionLabel: "Measured stock",
    touch: calculateShortGameTouchSummary(shots, 40, { clubType: type }),
    type,
    brandModel: `Synthetic ${index % 2 ? "TaylorMade Qi35 Max Lite Designer Series with Long Equipment Description" : "CallawayParadymAiSmokeTripleDiamondMaxCustomSpecification"}`,
    rawShotCount: 1240,
    stock: calculateStockYardage(shots, 40, { clubType: type }),
    personalBest: { carryYd: carry + 12, totalYd: carry + 22 },
    stockTrend: null,
    shots,
    evolutionShots: shots,
  };
});

const benchmarks = buildClubBenchmarkRows(
  clubs.map((club) => ({
    clubId: club.id,
    clubType: club.type,
    brandModel: club.brandModel,
    carryYd: club.stock.carryMedianYd,
    sampleSize: 30,
    reviewedShotCount: 40,
    savedShotCount: 1240,
    confidenceScore: 80,
    metrics: {
      carryYd: club.stock.carryMedianYd,
      clubSpeedMph: 93,
      ballSpeedMph: 137,
      smashFactor: 1.47,
      maxHeightYd: 31,
      landAngleDeg: 43,
    },
  })),
);
const quickClubs = clubs.map((club) => mobileQuickBagClub(club, club.shots));
const intelligence = buildPerformanceIntelligence(
  clubs.flatMap((club) =>
    club.shots.map((shot) => ({
      ...shot,
      clubId: club.id,
      source: "synthetic",
      equipmentId: club.id,
      settingsKey: "raw",
      ballType: "synthetic-ball",
      environment: "outdoor",
      normalization: "raw",
    })),
  ),
);
const query = new URLSearchParams(location.search);
const activeTab =
  query.get("tab") ??
  (query.get("view") === "target"
    ? "clubs"
    : query.get("mobile") === "benchmarks"
      ? "evidence"
      : "distances");
const Shell = query.get("surface") === "companion" ? CompanionAppShell : WorkbenchAppShell;
createRoot(document.getElementById("root")!).render(
  <TooltipProvider>
    <Shell totalXp={2500} surface="workbench">
      <p className="px-4">SYNTHETIC POPULATED BAG — actual complete page render</p>
      <BagMobilePage
        benchmarkMode={{ bag: clubs, benchmarkRows: benchmarks, intelligence }}
        profile={{ handicapBand: "average" }}
        featureData={{
          dataHealth: { metric: "Measured", status: "Synthetic comparable evidence" },
        }}
        speedSummary={null}
        equipmentContext={{
          history: [
            {
              id: "synthetic-equipment",
              clubType: "driver",
              ballBrand: "Synthetic",
              ballModel: "LongBallModelNameWithoutWordBreaksTourPerformance",
              effectiveFrom: new Date("2026-01-01"),
              effectiveTo: null,
              loftDeg: 10.5,
              lieDeg: 58,
              shaft: "Synthetic stiff shaft",
              swingWeight: "D3",
              notes: "Synthetic setup",
            },
          ],
          retired: [],
        }}
        quickBagClubs={quickClubs}
        accountId="synthetic-owner"
        preferences={{ preferredUnits: "yards" }}
        activeTab={activeTab}
        resolvedSearchParams={Object.fromEntries(query.entries())}
        peerBenchmarkSummary={{
          comparisons: [],
          cohortLabel: "Synthetic peers",
          peerUserCount: 0,
          peerShotCount: 0,
        }}
        peerBenchmarksLoaded={false}
        surface={query.get("surface") === "companion" ? "companion" : "workbench"}
      />
    </Shell>
  </TooltipProvider>,
);
