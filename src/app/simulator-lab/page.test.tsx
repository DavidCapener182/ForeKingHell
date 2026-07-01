import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSimulatorLabData: vi.fn(),
}));

vi.mock("@/lib/simulator-lab", () => ({
  getSimulatorLabData: mocks.getSimulatorLabData,
}));

vi.mock("@/app/simulator-lab/gapping-matrix-client", () => ({
  GappingMatrixClient: ({ rows }: { rows: unknown[] }) => (
    <div data-testid="gapping-matrix">Gapping rows: {rows.length}</div>
  ),
}));

vi.mock("@/app/simulator-lab/session-roast-panel", () => ({
  SessionRoastPanel: ({ facts }: { facts: unknown[] }) => (
    <div data-testid="roast-panel">Roast facts: {facts.length}</div>
  ),
}));

describe("/simulator-lab page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "postgres://test.local/forekinghell");
    mocks.getSimulatorLabData.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders empty and building states without simulator data", async () => {
    mocks.getSimulatorLabData.mockResolvedValue(emptyData());
    const Page = (await import("@/app/simulator-lab/page")).default;

    const html = renderToStaticMarkup(await Page());

    expect(html).toContain("Simulator Data Lab");
    expect(html).toContain("Gapping rows: 0");
    expect(html).toContain("Import a simulator session to unlock 30-day deltas.");
    expect(html).toContain("Log a club setup and retest to prove the change.");
  });

  it("renders populated WITB, delta, ledger and roast states", async () => {
    mocks.getSimulatorLabData.mockResolvedValue(populatedData());
    const Page = (await import("@/app/simulator-lab/page")).default;

    const html = renderToStaticMarkup(await Page());

    expect(html).toContain("trackman / 30 May 2026");
    expect(html).toContain("Gapping rows: 1");
    expect(html).toContain("Roast facts: 1");
    expect(html).toContain("Latest simulator block beat the 30-day baseline.");
    expect(html).toContain("9 deg loft / Sleeve down");
  });
});

function emptyData() {
  return {
    latestSession: null,
    totals: {
      activeClubs: 0,
      gappingRows: 0,
      latestSessionShots: 0,
      gapFlags: 0,
      positiveDeltas: 0,
      equipmentChanges: 0,
    },
    gappingRows: [],
    sessionDeltas: [],
    equipmentImpacts: [],
    roastFacts: [],
  };
}

function populatedData() {
  return {
    latestSession: {
      id: "session-1",
      source: "trackman",
      type: "simulator",
      date: new Date("2026-05-30T12:00:00.000Z"),
      fileName: "trackman.csv",
    },
    totals: {
      activeClubs: 1,
      gappingRows: 1,
      latestSessionShots: 3,
      gapFlags: 1,
      positiveDeltas: 1,
      equipmentChanges: 1,
    },
    gappingRows: [
      {
        clubId: "club-7i",
        clubType: "7i",
        clubLabel: "7 Iron",
        brandModel: "FKH 7I",
        recommendedCarryYd: 160,
        bestStockCarryYd: 158,
        latestReliableCarryYd: 159,
        latestReliableCarryP25Yd: 156,
        latestReliableCarryP75Yd: 162,
        sampleSize: 12,
        confidenceScore: 75,
        confidenceLabel: "Trusted",
        gapToNextYd: 24,
        nextClubType: "8i",
        gapStatus: "danger",
        gapLabel: "Missing window",
        gapDetail: "This is wide enough to plan a retest or setup check.",
        tone: "amber",
      },
    ],
    sessionDeltas: [
      {
        clubType: "7i",
        clubLabel: "7 Iron",
        latestShotCount: 3,
        baselineShotCount: 5,
        carryDeltaYd: 6,
        ballSpeedDeltaMph: 3,
        smashDelta: 0.03,
        offlineDeltaYd: -4,
        carrySpreadDeltaYd: -2,
        verdict: "better",
        summary: "Latest simulator block beat the 30-day baseline.",
        tone: "green",
      },
    ],
    equipmentImpacts: [
      {
        id: "history-1",
        clubId: "driver",
        clubType: "driver",
        clubLabel: "Driver",
        equipmentLabel: "9 deg loft / Sleeve down",
        effectiveFrom: new Date("2026-05-15T09:00:00.000Z"),
        effectiveTo: null,
        beforeShotCount: 5,
        afterShotCount: 5,
        carryDeltaYd: 10,
        ballSpeedDeltaMph: 5,
        smashDelta: 0.05,
        offlineDeltaYd: -7,
        verdict: "helped",
        detail: "Compared with the 30-day window before this setup change.",
        tone: "green",
      },
    ],
    roastFacts: [
      {
        label: "Wildest miss",
        value: "Driver +46 yd",
        detail: "Largest offline shot in the latest simulator session.",
        severity: "spicy",
      },
    ],
  };
}
