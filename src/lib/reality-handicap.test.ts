import { describe, expect, it } from "vitest";

import {
  buildRangeRealityHandicapData,
  isUsableRangeRealityShot,
  type RealityHandicapShot,
} from "@/lib/reality-handicap";
import type { ShotReviewStatus } from "@/lib/shot-review";

const excludedReviewStatuses = [
  "suggested_exclusion",
  "user_excluded",
  "calibration",
  "warm_up",
  "launch_monitor_error",
] as const satisfies readonly ShotReviewStatus[];

describe("range reality handicap", () => {
  it("returns a numeric estimate for a broad range sample", () => {
    const data = buildRangeRealityHandicapData([
      ...rangeSet("driver", 36, 245, 12),
      ...rangeSet("7i", 30, 155, 8),
      ...rangeSet("pw", 28, 118, 6),
    ]);

    expect(data.estimate.value).not.toBeNull();
    expect(data.estimate.confidence).toBe("medium");
    expect(data.estimate.expectedRangeLabel).toContain("-");
    expect(data.estimate.confidenceScore).toBeGreaterThan(0);
    expect(data.estimate.methodLabel).toContain("94 shots");
    expect(data.bagTruth[0]?.carryRangeLabel).toContain("yd");
    expect(data.flightLines.length).toBeGreaterThan(0);
  });

  it("keeps low samples in building state", () => {
    const data = buildRangeRealityHandicapData(rangeSet("driver", 8, 230, 18));

    expect(data.estimate.value).toBeNull();
    expect(data.estimate.confidence).toBe("building");
    expect(data.estimate.caveats.join(" ")).toContain("20 full-swing range shots");
  });

  it("adds a caveat and avoids directional cost when offline data is missing", () => {
    const data = buildRangeRealityHandicapData([
      ...rangeSet("driver", 14, 235, null),
      ...rangeSet("7i", 12, 150, null),
    ]);

    expect(data.estimate.value).not.toBeNull();
    expect(data.estimate.caveats.join(" ")).toContain("Offline or side-carry is missing");
    expect(data.costlyShots.every((item) => !item.reason.includes("offline"))).toBe(true);
  });

  it("prioritises severe directional misses as costly shots", () => {
    const shots = [
      ...rangeSet("driver", 24, 245, 8),
      ...rangeSet("7i", 20, 155, 6),
      shot({ id: "wild", clubType: "driver", carryYd: 242, sideCarryYd: 72 }),
      shot({ id: "straight-short", clubType: "driver", carryYd: 205, sideCarryYd: 2 }),
    ];
    const data = buildRangeRealityHandicapData(shots);

    expect(data.costlyShots[0]?.id).toBe("wild");
    expect(data.costlyShots[0]?.reason).toContain("offline");
    expect(data.costlyShotGroups[0]?.clubLabel).toBe("Driver");
    expect(data.costlyShotGroups[0]?.mainMisses).toContain("Right miss");
    expect(data.flightLines.find((line) => line.id === "wild")?.isCostly).toBe(true);
    expect(data.flightLines.find((line) => line.id === "wild")?.isDirectionalDamage).toBe(true);
    expect(data.flightLines.find((line) => line.id === "straight-short")?.isCostly).toBe(true);
    expect(data.flightLines.find((line) => line.id === "straight-short")?.isDirectionalDamage).toBe(
      false,
    );
  });

  it("keeps target-corridor shots visible when a club has many danger misses", () => {
    const shots = [
      ...rangeSet("driver", 30, 245, 55),
      ...rangeSet("driver", 18, 246, 4),
      ...rangeSet("7i", 20, 155, 6),
    ];
    const data = buildRangeRealityHandicapData(shots);
    const driverLines = data.flightLines.filter((line) => line.clubType === "driver");

    expect(driverLines.some((line) => Math.abs(line.sideYd) <= 10)).toBe(true);
    expect(driverLines.some((line) => line.isDirectionalDamage)).toBe(true);
  });

  it("weights the headline to newer shots before older history", () => {
    const newer = [
      ...datedRangeSet("driver", 50, 250, 8, "2026-07-10"),
      ...datedRangeSet("7i", 50, 155, 6, "2026-07-10"),
      ...datedRangeSet("driver", 50, 230, 55, "2026-07-09"),
      ...datedRangeSet("7i", 50, 140, 42, "2026-07-09"),
      ...datedRangeSet("driver", 350, 244, 18, "2026-07-08"),
      ...datedRangeSet("7i", 350, 151, 16, "2026-07-08"),
    ];
    const older = [
      ...datedRangeSet("driver", 120, 230, 55, "2026-05-01"),
      ...datedRangeSet("7i", 120, 140, 42, "2026-04-30"),
    ];
    const data = buildRangeRealityHandicapData([...older, ...newer]);

    expect(data.estimate.modelShotCount).toBe(800);
    expect(data.estimate.methodLabel).toContain("up to 1.5 shots");
    expect(data.estimate.caveats.join(" ")).toContain("weighted to the latest");
    expect(data.estimate.trend.direction).toBe("improving");
    expect(data.estimate.timeline.length).toBeGreaterThan(0);
    expect(new Set(data.flightLines.map((line) => line.clubType)).size).toBeGreaterThan(1);
  });

  it("includes range and practice bay shots but excludes scorecard rounds", () => {
    expect(isUsableRangeRealityShot(shot({ sessionType: "range" }))).toBe(true);
    expect(
      isUsableRangeRealityShot(shot({ sessionType: "simulator", playContext: "practice_bay" })),
    ).toBe(true);
    expect(
      isUsableRangeRealityShot(shot({ sessionType: "real_round", playContext: "on_course" })),
    ).toBe(false);
    expect(
      isUsableRangeRealityShot(shot({ sessionType: "simulated_course", playContext: "simulator" })),
    ).toBe(false);
  });

  it("uses only included and restored lifecycle evidence", () => {
    for (const reviewStatus of excludedReviewStatuses) {
      expect(isUsableRangeRealityShot(shot({ reviewStatus }))).toBe(false);
    }

    expect(
      isUsableRangeRealityShot(
        shot({
          reviewStatus: "restored",
          qualityTag: "bad_data",
          shotCategory: "warm_up",
        }),
      ),
    ).toBe(true);
    expect(
      isUsableRangeRealityShot(
        shot({ reviewStatus: "included", qualityTag: "bad_data", shotCategory: "full" }),
      ),
    ).toBe(false);
    expect(isUsableRangeRealityShot(shot({ reviewStatus: "restored", shotCategory: "chip" }))).toBe(
      false,
    );
  });
});

function rangeSet(
  clubType: string,
  count: number,
  carryBase: number,
  sideBase: number | null,
): RealityHandicapShot[] {
  return Array.from({ length: count }, (_, index) =>
    shot({
      id: `${clubType}-${index}`,
      clubType,
      carryYd: carryBase + (index % 5) - 2,
      totalYd: carryBase + 8 + (index % 5) - 2,
      sideCarryYd: sideBase === null ? null : sideBase * (index % 2 === 0 ? 1 : -1),
      sessionId: `session-${Math.floor(index / 12)}`,
    }),
  );
}

function datedRangeSet(
  clubType: string,
  count: number,
  carryBase: number,
  sideBase: number,
  isoDate: string,
): RealityHandicapShot[] {
  return Array.from({ length: count }, (_, index) =>
    shot({
      id: `${clubType}-${isoDate}-${index}`,
      clubType,
      carryYd: carryBase + (index % 5) - 2,
      totalYd: carryBase + 8 + (index % 5) - 2,
      sideCarryYd: sideBase * (index % 2 === 0 ? 1 : -1),
      sessionId: `session-${isoDate}`,
      shotAt: new Date(`${isoDate}T10:${String(index % 60).padStart(2, "0")}:00Z`),
    }),
  );
}

function shot(overrides: Partial<RealityHandicapShot> = {}): RealityHandicapShot {
  return {
    id: "shot",
    sessionId: "session",
    clubId: "club",
    clubType: "driver",
    shotAt: new Date("2026-07-01T10:00:00Z"),
    playContext: "practice_bay",
    sessionType: "range",
    source: "rapsodo",
    carryYd: 240,
    totalYd: 255,
    sideCarryYd: 10,
    ballSpeedMph: 145,
    launchAngleDeg: 12,
    launchDirectionDeg: 1.5,
    spinAxis: null,
    shotCategory: "full",
    qualityTag: null,
    ...overrides,
  };
}
