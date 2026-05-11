import { describe, expect, it } from "vitest";

import {
  dedupeUnlockCandidates,
  evaluateAllAchievementCandidates,
  evaluateRapsodoSessionAchievements,
  evaluateRoundScorecardAchievements,
} from "./evaluator";
import type { AchievementSession, AchievementShot, RoundScorecardHole } from "./types";

const sessionDate = new Date("2026-05-01T12:00:00.000Z");

describe("Rapsodo achievement evaluation", () => {
  it("unlocks core and generated driver badges from shot metrics", () => {
    const shot = makeShot({
      id: "shot-1",
      clubType: "driver",
      carryYd: 205,
      totalYd: 225,
      ballSpeedMph: 142,
      clubSpeedMph: 98,
      launchAngleDeg: 14,
      sideCarryYd: 4,
      smashFactor: 1.5,
      attackAngleDeg: 2.5,
      clubPathDeg: 2,
    });
    const result = evaluateRapsodoSessionAchievements(makeSession(), [shot]);
    const ids = achievementIds(result.unlocks);

    expect(ids).toContain("driver_total_220");
    expect(ids).toContain("driver_carry_200");
    expect(ids).toContain("driver_launch_window_single");
    expect(ids).toContain("driver_bomb_straight");
    expect(ids).toContain("driver_smash_150");
    expect(ids).toContain("club_driver_carry_205");
    expect(ids).toContain("club_driver_total_225");
    expect(ids).toContain("club_driver_ball_speed_140");
    expect(ids).toContain("club_driver_offline_5");
  });

  it("unlocks session, consistency, and 5W badges", () => {
    const shots = Array.from({ length: 20 }, (_, index) =>
      makeShot({
        id: `fivewood-${index}`,
        clubType: "5w",
        shotNumber: index + 1,
        carryYd: 170 + (index % 3),
        totalYd: 194 + (index % 3),
        launchAngleDeg: 13,
        sideCarryYd: index % 2 === 0 ? 4 : -4,
      }),
    );
    const result = evaluateRapsodoSessionAchievements(makeSession(), shots);
    const ids = achievementIds(result.unlocks);

    expect(ids).toContain("fivewood_unlocked");
    expect(ids).toContain("fivewood_carry_170");
    expect(ids).toContain("fivewood_no_top_zone");
    expect(ids).toContain("fivewood_stock_built");
    expect(ids).toContain("focused_session");
    expect(ids).toContain("carry_consistency");
  });

  it("unlocks generated club-volume badges from the shot that crosses the threshold", () => {
    const shots = Array.from({ length: 20 }, (_, index) =>
      makeShot({
        id: `seveniron-${index}`,
        clubType: "7i",
        shotNumber: index + 1,
        shotAt: new Date(`2026-05-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
      }),
    );
    const result = evaluateRapsodoSessionAchievements(makeSession(), shots);
    const ids = achievementIds(result.unlocks);
    const baseline = result.unlocks.find((unlock) => unlock.achievementId === "club_7i_volume_20");

    expect(ids).toContain("club_7i_volume_5");
    expect(ids).toContain("club_7i_volume_10");
    expect(ids).toContain("club_7i_volume_20");
    expect(ids).not.toContain("club_7i_volume_30");
    expect(baseline?.sourceShotId).toBe("seveniron-19");
  });

  it("unlocks generated club-session mastery badges from consistent sessions", () => {
    const shots = Array.from({ length: 10 }, (_, index) =>
      makeShot({
        id: `mastery-7i-${index}`,
        clubType: "7i",
        shotNumber: index + 1,
        carryYd: 150 + (index % 4),
        totalYd: 162 + (index % 5),
        launchAngleDeg: 16 + (index % 3) * 0.5,
        sideCarryYd: index % 2 === 0 ? 2 : -2,
        smashFactor: 1.35,
      }),
    );
    const result = evaluateRapsodoSessionAchievements(makeSession(), shots);
    const ids = achievementIds(result.unlocks);
    const carryMastery = result.unlocks.find((unlock) => unlock.achievementId === "club_7i_mastery_carry_spread_12");

    expect(ids).toContain("club_7i_mastery_carry_spread_12");
    expect(ids).toContain("club_7i_mastery_total_spread_15");
    expect(ids).toContain("club_7i_mastery_offline_average_5");
    expect(ids).toContain("club_7i_mastery_launch_spread_25");
    expect(ids).toContain("club_7i_mastery_smash_average_133");
    expect(ids).not.toContain("club_7i_mastery_smash_average_136");
    expect(carryMastery?.sourceSessionId).toBe("session-1");
  });

  it("does not unlock generated sand wedge distance badges from round touch shots", () => {
    const shot = makeShot({
      id: "sw-chip",
      clubType: "sw",
      carryYd: 40,
      totalYd: 42,
      courseHoleNumber: 6,
      shotCategory: "approach",
    });
    const result = evaluateRapsodoSessionAchievements(makeSession(), [shot]);
    const ids = achievementIds(result.unlocks);

    expect(ids).not.toContain("club_sw_carry_40");
    expect(ids).not.toContain("club_sw_total_40");
  });

  it("dedupes repeated candidates for idempotent backfills", () => {
    const deduped = dedupeUnlockCandidates([
      { achievementId: "break_90", unlockedAt: new Date("2026-05-02T12:00:00.000Z") },
      { achievementId: "break_90", unlockedAt: new Date("2026-05-01T12:00:00.000Z") },
      { achievementId: "birdie_hunter", unlockedAt: new Date("2026-05-01T12:00:00.000Z") },
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped.find((candidate) => candidate.achievementId === "break_90")?.unlockedAt?.toISOString()).toBe(
      "2026-05-01T12:00:00.000Z",
    );
  });

  it("evaluates stock, gapping, and progress from historical context", () => {
    const result = evaluateAllAchievementCandidates({
      sessions: [makeSession()],
      shots: [
        ...Array.from({ length: 20 }, (_, index) =>
          makeShot({
            id: `early-${index}`,
            clubType: "driver",
            shotNumber: index + 1,
            shotAt: new Date("2026-04-01T12:00:00.000Z"),
            carryYd: 185,
            ballSpeedMph: 120,
            sideCarryYd: -30,
          }),
        ),
        ...Array.from({ length: 20 }, (_, index) =>
          makeShot({
            id: `recent-${index}`,
            clubType: "driver",
            shotNumber: index + 21,
            shotAt: new Date("2026-05-01T12:00:00.000Z"),
            carryYd: 200,
            ballSpeedMph: 128,
            sideCarryYd: -10,
          }),
        ),
      ],
      clubs: [
        { id: "driver-club", type: "driver", active: true },
        { id: "fivewood-club", type: "5w", active: true },
        { id: "fiveiron-club", type: "5i", active: true },
        { id: "eightiron-club", type: "8i", active: true },
        { id: "nineiron-club", type: "9i", active: true },
        { id: "pw-club", type: "pw", active: true },
      ],
      stockYardages: [
        stock("driver-club", "driver", 190, 70, "2026-04-01"),
        stock("driver-club", "driver", 201, 80, "2026-05-01"),
        stock("fivewood-club", "5w", 175, 80, "2026-05-01"),
        stock("fiveiron-club", "5i", 155, 80, "2026-05-01"),
        stock("eightiron-club", "8i", 130, 80, "2026-05-01"),
        stock("nineiron-club", "9i", 120, 80, "2026-05-01"),
        stock("pw-club", "pw", 108, 80, "2026-05-01"),
      ],
    });
    const ids = achievementIds(result.unlocks);

    expect(ids).toContain("full_bag_mapped");
    expect(ids).toContain("top_end_fixed");
    expect(ids).toContain("eight_nine_gap_healthy");
    expect(ids).toContain("distance_up_10");
    expect(ids).toContain("ball_speed_gain");
    expect(ids).toContain("hook_exorcist");
  });
});

describe("round achievement evaluation", () => {
  it("unlocks scoring, birdie, eagle, and putting achievements", () => {
    const holes = Array.from({ length: 18 }, (_, index): RoundScorecardHole => {
      const holeNumber = index + 1;
      const par = holeNumber === 2 ? 5 : 4;
      const score = holeNumber === 2 ? 3 : holeNumber === 4 ? 3 : 4;

      return {
        holeNumber,
        par,
        yards: 400,
        name: null,
        score,
        putts: holeNumber === 18 ? 1 : holeNumber <= 12 ? 1 : 2,
        penalties: 0,
        fairwayHit: holeNumber <= 9,
        gir: holeNumber <= 10,
      };
    });
    const result = evaluateRoundScorecardAchievements(makeSession({ scorecardJson: holes }));
    const ids = achievementIds(result.unlocks);

    expect(ids).toContain("break_80");
    expect(ids).toContain("sub_40_nine");
    expect(ids).toContain("birdie_hunter");
    expect(ids).toContain("two_birdie_round");
    expect(ids).toContain("eagle_landed");
    expect(ids).toContain("no_3_putt_round");
    expect(ids).toContain("thirty_putt_round");
    expect(ids).toContain("flatstick_god_mode");
    expect(ids).toContain("clutch_finish");
    expect(ids).toContain("penalty_free");
    expect(ids).toContain("ball_striking_day");
  });

  it("uses objective round stats for FIR, GIR, scrambling, clean cards, and bounce backs", () => {
    const holes = Array.from({ length: 18 }, (_, index): RoundScorecardHole => {
      const holeNumber = index + 1;
      const par = 4;
      const score = holeNumber === 3 ? 6 : holeNumber === 4 ? 4 : holeNumber >= 10 ? 4 : 5;

      return {
        holeNumber,
        par,
        yards: 400,
        name: null,
        score,
        putts: 2,
        penalties: 0,
        fairwayHit: holeNumber <= 8,
        gir: holeNumber <= 8 ? true : false,
      };
    });
    const result = evaluateRoundScorecardAchievements(makeSession({ scorecardJson: holes }));
    const ids = achievementIds(result.unlocks);

    expect(ids).toContain("bounce_back");
    expect(ids).toContain("clean_card");
    expect(ids).toContain("fairway_finder_round");
    expect(ids).toContain("driver_trust");
    expect(ids).toContain("gir_machine");
    expect(ids).toContain("scramble_upgrade");
  });
});

function achievementIds(candidates: Array<{ achievementId: string }>) {
  return candidates.map((candidate) => candidate.achievementId);
}

function makeSession(overrides: Partial<AchievementSession> = {}): AchievementSession {
  return {
    id: "session-1",
    source: "rapsodo",
    type: "range",
    date: sessionDate,
    scorecardJson: null,
    ...overrides,
  };
}

function makeShot(overrides: Partial<AchievementShot>): AchievementShot {
  return {
    id: "shot",
    sessionId: "session-1",
    shotAt: sessionDate,
    clubType: "driver",
    shotNumber: 1,
    carryYd: null,
    totalYd: null,
    ballSpeedMph: null,
    clubSpeedMph: null,
    launchAngleDeg: null,
    launchDirectionDeg: null,
    apexFt: 90,
    sideCarryYd: null,
    courseHoleNumber: null,
    attackAngleDeg: null,
    clubPathDeg: null,
    descentAngleDeg: null,
    smashFactor: null,
    shotCategory: "full",
    qualityTag: null,
    ...overrides,
  };
}

function stock(clubId: string, clubType: string, carryYd: number, confidence: number, date: string) {
  return {
    clubId,
    clubType,
    calculatedAt: new Date(`${date}T12:00:00.000Z`),
    sampleSize: 20,
    carryMedianYd: carryYd,
    carryMeanYd: carryYd,
    totalMedianYd: carryYd + 10,
    dispersionLeftYd: 8,
    dispersionRightYd: 8,
    confidenceScore: confidence,
  };
}
