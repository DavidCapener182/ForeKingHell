import { describe, expect, it } from "vitest";

import {
  analyseSpeedFatigue,
  analyseSpeedFatigueSwings,
  buildSpeedDevelopment,
  type BuildSpeedDevelopmentInput,
  type SpeedDevelopmentDriverShotInput,
  type SpeedDevelopmentSessionInput,
} from "@/lib/speed-development";

describe("driver speed development", () => {
  it("only recommends stopping after two consecutive swings cross the 4% fatigue line", () => {
    const oneLowSwing = analyseSpeedFatigue([91.2, 92, 93.1, 92.8, 89.2, 91]);
    const twoLowSwings = analyseSpeedFatigue([91.2, 92, 93.1, 92.8, 89.2, 89.1]);

    expect(oneLowSwing).toMatchObject({
      peakSpeedMph: 93.1,
      peakSwingNumber: 3,
      stopRecommended: false,
      stopAfterSwingNumber: null,
    });
    expect(twoLowSwings).toMatchObject({
      thresholdMph: 89.4,
      stopRecommended: true,
      stopAfterSwingNumber: 6,
    });
  });

  it("unlocks ladder levels from the rolling three-session average, not one fast swing", () => {
    const summary = buildSpeedDevelopment(
      input({
        sessions: [
          session("current", "2026-08-18", 92.5, 96),
          session("previous", "2026-08-14", 92.1, 94),
          session("third", "2026-08-10", 92.2, 93),
          session("old", "2026-08-01", 87, 100),
        ],
      }),
    );

    expect(summary.ladder.rollingThreeAvgMph).toBe(92.3);
    expect(summary.ladder.currentLevelMph).toBe(92);
    expect(summary.ladder.nextLevelMph).toBe(95);
    expect(summary.ladder.levels.find((level) => level.speedMph === 92)).toMatchObject({
      state: "unlocked",
      qualifyingSessions: 3,
    });
    expect(summary.ladder.levels.find((level) => level.speedMph === 95)).toMatchObject({
      state: "current",
      qualifyingSessions: 0,
    });
  });

  it("requires all three latest session averages to qualify for a ladder level", () => {
    const summary = buildSpeedDevelopment(
      input({
        sessions: [
          session("current", "2026-08-18", 100, 101),
          session("previous", "2026-08-14", 100, 101),
          session("third", "2026-08-10", 76, 100),
        ],
      }),
    );

    expect(summary.ladder.rollingThreeAvgMph).toBe(92);
    expect(summary.ladder.currentLevelMph).toBeNull();
    expect(summary.ladder.levels.find((level) => level.speedMph === 92)).toMatchObject({
      state: "locked",
      qualifyingSessions: 2,
    });
  });

  it("does not celebrate a faster driver session when dispersion becomes materially wider", () => {
    const summary = buildSpeedDevelopment(
      input({
        sessions: [session("speed-1", "2026-08-17", 94, 96)],
        driverShots: [
          ...driverSession("latest", "2026-08-18", {
            clubSpeedMph: 92,
            ballSpeedMph: 132,
            sideCarryYd: 35,
          }),
          ...driverSession("previous", "2026-08-12", {
            clubSpeedMph: 88,
            ballSpeedMph: 128,
            sideCarryYd: 10,
          }),
        ],
      }),
    );

    expect(summary.chaos).toMatchObject({
      status: "not_transferred",
      label: "Speed gained — not transferred yet",
      speedGainMph: 4,
      ballSpeedGainMph: 4,
      offlineChangeYd: 25,
      playableRateChangePct: -100,
    });
    expect(summary.chaos.nextAction).toContain("10-ball transfer block");
    expect(summary.readiness.recommendation).toContain("Transfer session");
  });

  it("does not claim transfer success without ball-speed and lateral evidence", () => {
    const missingEvidence = buildSpeedDevelopment(
      input({
        driverShots: [
          ...driverSession("latest", "2026-08-18", {
            clubSpeedMph: 94,
            ballSpeedMph: null,
            sideCarryYd: null,
          }),
          ...driverSession("previous", "2026-08-12", {
            clubSpeedMph: 90,
            ballSpeedMph: null,
            sideCarryYd: null,
          }),
        ],
      }),
    );
    const lostBallSpeed = buildSpeedDevelopment(
      input({
        driverShots: [
          ...driverSession("latest", "2026-08-18", {
            clubSpeedMph: 94,
            ballSpeedMph: 125,
            sideCarryYd: 10,
          }),
          ...driverSession("previous", "2026-08-12", {
            clubSpeedMph: 90,
            ballSpeedMph: 130,
            sideCarryYd: 10,
          }),
        ],
      }),
    );

    expect(missingEvidence.chaos.status).toBe("need_evidence");
    expect(lostBallSpeed.chaos).toMatchObject({
      status: "not_transferred",
      ballSpeedGainMph: -5,
    });
  });

  it("does not relabel a measured all-wide pattern as playing speed", () => {
    const summary = buildSpeedDevelopment(
      input({
        driverShots: driverSession("wide", "2026-08-18", {
          clubSpeedMph: 93,
          sideCarryYd: 35,
        }),
      }),
    );

    const playing = summary.funnel.find((stage) => stage.key === "playing");
    expect(playing).toMatchObject({ valueMph: null, sampleSize: 0 });
    expect(playing?.source).toContain("No playable baseline");
    expect(summary.project.ingredients.find((item) => item.key === "control")?.status).toBe(
      "needs_work",
    );
  });

  it("keeps ceiling, transfer, playing and course speed as distinct evidence stages", () => {
    const summary = buildSpeedDevelopment(
      input({
        sessions: [session("speed-1", "2026-08-17", 96, 98.4)],
        driverShots: [
          ...driverSession("range", "2026-08-18", {
            clubSpeedMph: 93.2,
            ballSpeedMph: 133,
            sideCarryYd: 12,
          }),
          ...driverSession("course", "2026-08-16", {
            clubSpeedMph: 89.4,
            ballSpeedMph: 129,
            sideCarryYd: 15,
            playContext: "on_course",
          }),
        ],
      }),
    );

    expect(summary.funnel.map((stage) => stage.key)).toEqual([
      "ceiling",
      "transfer",
      "playing",
      "course",
    ]);
    expect(summary.funnel.map((stage) => stage.valueMph)).toEqual([98.4, 93.2, 93.2, 89.4]);
    expect(summary.funnel[3]?.lossFromPreviousMph).toBe(3.8);
  });

  it("keeps a latest-session verdict pending until transfer evidence follows that session", () => {
    const pending = buildSpeedDevelopment(
      input({
        sessions: [session("speed", "2026-08-18", 92, 93)],
        driverShots: driverSession("before", "2026-08-17", {
          clubSpeedMph: 90,
          ballSpeedMph: 130,
          sideCarryYd: 10,
        }),
      }),
    );
    const transferred = buildSpeedDevelopment(
      input({
        sessions: [
          session("latest-speed", "2026-08-17", 92, 93),
          session("older-pb", "2026-08-10", 98, 100),
        ],
        driverShots: [
          ...driverSession("after", "2026-08-18", {
            clubSpeedMph: 90,
            ballSpeedMph: 132,
            sideCarryYd: 10,
          }),
          ...driverSession("before", "2026-08-12", {
            clubSpeedMph: 88,
            ballSpeedMph: 128,
            sideCarryYd: 10,
          }),
        ],
      }),
    );

    expect(pending.verdict).toMatchObject({
      grade: "Pending",
      playingSpeedMph: null,
      transferEfficiencyPct: null,
    });
    expect(transferred.verdict).toMatchObject({
      sessionId: "latest-speed",
      playingSpeedMph: 90,
      transferEfficiencyPct: 96.8,
    });
  });

  it("treats carry as the outcome and identifies ball-speed frequency when launch is sufficient", () => {
    const shots = driverSession("latest", "2026-08-18", {
      clubSpeedMph: 92,
      ballSpeedMph: 132,
      smashFactor: 1.43,
      carryYd: 216.6,
      launchAngleDeg: 14,
      sideCarryYd: 10,
    });
    const summary = buildSpeedDevelopment(
      input({
        targetSpeedMph: 95,
        driverShots: shots,
      }),
    );

    expect(summary.project).toMatchObject({
      label: "Project 220",
      targetCarryYd: 220,
      currentBestCarryYd: 216.6,
      gapYd: 3.4,
      limitingFactor: "Ball-speed frequency",
    });
    expect(summary.project.coachMessage).toContain("not missing 220 because of launch");
    expect(summary.metrics.find((metric) => metric.key === "best_carry")?.detail).toContain(
      "Outcome measure",
    );
  });

  it("degrades honestly when evidence is missing and respects high recent load", () => {
    const missing = buildSpeedDevelopment(input());
    const loaded = buildSpeedDevelopment(
      input({
        trainingLoad: {
          fitness: 90,
          fatigue: 160,
          form: 72,
          statusKey: "load_high",
          trendKey: "acute_load_spike",
        },
      }),
    );

    expect(missing.funnel.every((stage) => stage.valueMph === null)).toBe(true);
    expect(missing.chaos.status).toBe("need_evidence");
    expect(missing.project.currentBestCarryYd).toBeNull();
    expect(missing.project.limitingFactor).toBe("Need Driver evidence");
    expect(missing.readiness.status).not.toBe("ready");
    expect(loaded.readiness).toMatchObject({
      status: "recover",
      label: "RECOVER",
    });
    expect(loaded.plan.mode).toBe("technical");
    expect(loaded.plan.blocks.some((block) => block.target.includes("maximum"))).toBe(false);
    expect(loaded.readiness.nextRecommendedDateIso).toBeNull();
  });

  it("uses numeric fatigue as a recovery gate and preserves real swing numbers", () => {
    const fatigue = analyseSpeedFatigueSwings([
      { swingNumber: 28, clubSpeedMph: 100 },
      { swingNumber: 29, clubSpeedMph: 95 },
      { swingNumber: 30, clubSpeedMph: 95 },
    ]);
    const summary = buildSpeedDevelopment(
      input({
        trainingLoad: {
          fitness: 40,
          fatigue: 160,
          form: -120,
          statusKey: "balanced",
          trendKey: "steady",
        },
      }),
    );

    expect(fatigue).toMatchObject({ stopRecommended: true, stopAfterSwingNumber: 30 });
    expect(summary.readiness.status).toBe("recover");
  });

  it("ignores unknown context and implausible or excluded measurements", () => {
    const summary = buildSpeedDevelopment(
      input({
        currentCarryYd: 800,
        driverShots: [
          ...driverSession("unknown", "2026-08-19", {
            playContext: "outdoor",
            clubSpeedMph: 120,
            carryYd: 800,
            ballSpeedMph: 999,
            qualityTag: "misread",
          }),
          ...driverSession("clean", "2026-08-18", {
            carryYd: 216.6,
          }),
        ],
      }),
    );

    expect(summary.project.currentBestCarryYd).toBe(216.6);
    expect(summary.funnel.find((stage) => stage.key === "course")?.valueMph).toBeNull();
    expect(summary.project.carrySource).toBe("Best clean measured Driver carry");
  });

  it.each([
    "suggested_exclusion",
    "user_excluded",
    "calibration",
    "warm_up",
    "launch_monitor_error",
  ] as const)("ignores %s shots across every speed-development output", (reviewStatus) => {
    const summary = buildSpeedDevelopment(
      input({
        driverShots: [
          ...driverSession("reviewed", "2026-08-19", {
            reviewStatus,
            clubSpeedMph: 120,
            ballSpeedMph: 180,
            smashFactor: 1.5,
            carryYd: 350,
            sideCarryYd: 5,
          }),
          ...driverSession("restored", "2026-08-18", {
            reviewStatus: "restored",
            clubSpeedMph: 90,
            ballSpeedMph: 130,
            smashFactor: 1.44,
            carryYd: 210,
            sideCarryYd: 10,
          }),
        ],
      }),
    );

    expect(summary.funnel.find((stage) => stage.key === "transfer")).toMatchObject({
      valueMph: 90,
      sampleSize: 5,
    });
    expect(summary.funnel.find((stage) => stage.key === "playing")).toMatchObject({
      valueMph: 90,
      sampleSize: 5,
    });
    expect(summary.project).toMatchObject({
      currentBestCarryYd: 210,
      carrySampleSize: 5,
    });
    expect(summary.chaos.status).toBe("need_evidence");
    expect(
      summary.readiness.reasons.find((reason) => reason.label === "Driver control"),
    ).toMatchObject({ state: "missing" });
  });
});

function input(overrides: Partial<BuildSpeedDevelopmentInput> = {}): BuildSpeedDevelopmentInput {
  return {
    nowIso: "2026-08-19T12:00:00.000Z",
    sessions: [],
    swings: [],
    driverShots: [],
    targetSpeedMph: null,
    trainingLoad: {
      fitness: 80,
      fatigue: 70,
      form: 105,
      statusKey: "balanced",
      trendKey: "steady",
    },
    ...overrides,
  };
}

function session(
  id: string,
  date: string,
  avgSpeedMph: number,
  maxSpeedMph: number,
): SpeedDevelopmentSessionInput {
  return {
    id,
    sessionDateIso: `${date}T10:00:00.000Z`,
    avgSpeedMph,
    maxSpeedMph,
    swingCount: 10,
    comparableToDriver: true,
  };
}

function driverSession(
  sessionId: string,
  date: string,
  overrides: Partial<SpeedDevelopmentDriverShotInput>,
): SpeedDevelopmentDriverShotInput[] {
  return Array.from({ length: 5 }, (_, index) => ({
    sessionId,
    shotAtIso: `${date}T10:0${index}:00.000Z`,
    playContext: "practice_bay",
    clubSpeedMph: 90,
    ballSpeedMph: 130,
    smashFactor: 1.44,
    carryYd: 210,
    launchAngleDeg: 14,
    sideCarryYd: 10,
    reviewStatus: "included",
    ...overrides,
  }));
}
