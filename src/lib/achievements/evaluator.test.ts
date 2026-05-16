import { describe, expect, it } from "vitest";

import {
  dedupeUnlockCandidates,
  evaluateAllAchievementCandidates,
  evaluateRapsodoSessionAchievements,
  evaluateRoundScorecardAchievements,
} from "./evaluator";
import { ACHIEVEMENTS } from "./registry";
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
    expect(ids).toContain("club_driver_volume_1");
    expect(ids).toContain("club_driver_offline_5");
    expect(ids).toContain("club_driver_carry_200");
    expect(ids).toContain("club_driver_total_220");
    expect(ids).not.toContain("club_driver_ball_speed_140");
  });

  it("registers club distance ladders without unrealistic wedge speed or distance targets", () => {
    const ids = ACHIEVEMENTS.map((achievement) => achievement.id);

    expect(ids.some((id) => /^club_(sw|lw)_(ball_speed|smash|offline)_/.test(id))).toBe(false);
    expect(ids).not.toContain("club_pw_ball_speed_180");
    expect(ids).not.toContain("club_gw_smash_155");
    expect(ids).not.toContain("club_sw_carry_130");
    expect(ids).not.toContain("club_lw_total_130");
    expect(ids).toContain("club_sw_carry_70");
    expect(ids).toContain("club_lw_total_50");
    expect(ids).toContain("club_sw_volume_1");
    expect(ids).toContain("club_lw_volume_1");
    expect(ids).toContain("club_driver_benchmark_average");
    expect(ids).toContain("club_9i_benchmark_good");
    expect(ids).toContain("club_3h_benchmark_tour");
    expect(ids).not.toContain("club_sw_benchmark_average");
    expect(ids).not.toContain("club_7w_benchmark_average");
    expect(ACHIEVEMENTS.filter((achievement) => achievement.category === "hidden").length).toBeGreaterThan(350);
  });

  it("unlocks generated hidden shot achievements from unusual shots", () => {
    const shot = makeShot({
      id: "driver-hidden",
      clubType: "driver",
      carryYd: 40,
      totalYd: 55,
      sideCarryYd: -75,
      launchAngleDeg: 3,
      apexFt: 12,
      smashFactor: 1.5,
      shotCategory: "full",
    });
    const result = evaluateRapsodoSessionAchievements(makeSession(), [shot]);
    const ids = achievementIds(result.unlocks);
    const leftDetour = result.unlocks.find((unlock) => unlock.achievementId === "club_driver_hidden_left_miss_70");

    expect(ids).toContain("club_driver_hidden_left_miss_70");
    expect(ids).toContain("club_driver_hidden_low_carry_45");
    expect(ids).toContain("club_driver_hidden_low_launch_4");
    expect(ids).toContain("club_driver_hidden_low_apex_20");
    expect(ids).toContain("club_driver_hidden_pure_wild_35");
    expect(ids).not.toContain("club_driver_hidden_centre_line_2");
    expect(leftDetour?.metadata).toMatchObject({ clubName: "Driver", sideCarryYd: -75, targetValue: 70 });
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
    expect(ids).toContain("club_5w_session_5");
    expect(ids).toContain("club_5w_session_10");
    expect(ids).toContain("club_5w_session_15");
    expect(ids).toContain("club_5w_session_20");
    expect(ids).not.toContain("club_5w_session_30");
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
    const firstStrike = result.unlocks.find((unlock) => unlock.achievementId === "club_7i_volume_1");
    const acquainted = result.unlocks.find((unlock) => unlock.achievementId === "club_7i_volume_10");

    expect(ids).toContain("club_7i_volume_1");
    expect(ids).toContain("club_7i_volume_5");
    expect(ids).toContain("club_7i_volume_10");
    expect(ids).toContain("club_7i_volume_15");
    expect(ids).not.toContain("club_7i_volume_25");
    expect(firstStrike?.sourceShotId).toBe("seveniron-0");
    expect(acquainted?.sourceShotId).toBe("seveniron-9");
  });

  it("unlocks generated club-mileage badges from cumulative total distance", () => {
    const shots = Array.from({ length: 20 }, (_, index) =>
      makeShot({
        id: `mileage-7i-${index}`,
        clubType: "7i",
        shotNumber: index + 1,
        shotAt: new Date(`2026-05-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
        totalYd: 200,
      }),
    );
    const result = evaluateRapsodoSessionAchievements(makeSession(), shots);
    const ids = achievementIds(result.unlocks);
    const firstMile = result.unlocks.find((unlock) => unlock.achievementId === "club_7i_miles_1");
    const twoMiles = result.unlocks.find((unlock) => unlock.achievementId === "club_7i_miles_2");
    const fiveMileProgress = result.progress.find((progress) => progress.achievementId === "club_7i_miles_5");

    expect(ids).toContain("club_7i_miles_1");
    expect(ids).toContain("club_7i_miles_2");
    expect(ids).not.toContain("club_7i_miles_5");
    expect(firstMile?.sourceShotId).toBe("mileage-7i-8");
    expect(twoMiles?.sourceShotId).toBe("mileage-7i-17");
    expect(twoMiles?.metadata).toMatchObject({ clubType: "7i", targetMiles: 2 });
    expect(fiveMileProgress?.progressValue).toBeCloseTo(4000 / 1760, 5);
    expect(fiveMileProgress?.targetValue).toBe(5);
  });

  it("uses carry distance for club-mileage progress when total distance is missing", () => {
    const shots = Array.from({ length: 9 }, (_, index) =>
      makeShot({
        id: `carry-mileage-7i-${index}`,
        clubType: "7i",
        shotNumber: index + 1,
        carryYd: 200,
        totalYd: null,
      }),
    );
    const result = evaluateRapsodoSessionAchievements(makeSession(), shots);
    const ids = achievementIds(result.unlocks);

    expect(ids).toContain("club_7i_miles_1");
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


  it("unlocks short-game wedge control achievements and short-game distance ladders", () => {
    const shots = [
      ...Array.from({ length: 5 }, (_, index) => makeShot({ id: `sw-50-${index}`, clubType: "sw", carryYd: 50, shotNumber: index + 1 })),
      ...Array.from({ length: 5 }, (_, index) => makeShot({ id: `sw-70-${index}`, clubType: "sw", carryYd: 70, shotNumber: index + 6 })),
      makeShot({ id: "sw-30", clubType: "sw", carryYd: 30, shotNumber: 11 }),
      ...Array.from({ length: 5 }, (_, index) => makeShot({ id: `lw-30-${index}`, clubType: "lw", carryYd: 30, shotNumber: index + 12 })),
      ...Array.from({ length: 5 }, (_, index) => makeShot({ id: `lw-40-${index}`, clubType: "lw", carryYd: 40, shotNumber: index + 17 })),
      makeShot({ id: "lw-20", clubType: "lw", carryYd: 20, shotNumber: 22 }),
      makeShot({ id: "lw-50", clubType: "lw", carryYd: 50, shotNumber: 23 }),
    ];
    const result = evaluateRapsodoSessionAchievements(makeSession(), shots);
    const ids = achievementIds(result.unlocks);

    expect(ids).toContain("sw_dialled_50");
    expect(ids).toContain("sw_dialled_70");
    expect(ids).toContain("sw_wedge_ladder_i");
    expect(ids).toContain("lw_30_yard_touch");
    expect(ids).toContain("lw_40_yard_touch");
    expect(ids).toContain("lw_lob_ladder");
    expect(ids).toContain("club_sw_volume_1");
    expect(ids).toContain("club_lw_volume_10");
    expect(ids).toContain("club_sw_carry_70");
    expect(ids).toContain("club_lw_carry_50");
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
    expect(ids).toContain("club_driver_pb_carry");
    expect(ids).toContain("club_driver_pb_with_control");
  });

  it("unlocks benchmark level achievements from reliable stock carries", () => {
    const result = evaluateAllAchievementCandidates({
      sessions: [],
      shots: [],
      clubs: [
        { id: "driver-club", type: "driver", active: true },
        { id: "fivewood-club", type: "5w", active: true },
        { id: "seveniron-club", type: "7i", active: true },
        { id: "eightiron-club", type: "8i", active: true },
        { id: "nineiron-club", type: "9i", active: true },
        { id: "retired-driver-club", type: "driver", active: false },
      ],
      stockYardages: [
        stock("driver-club", "driver", 250, 80, "2026-05-01"),
        stock("fivewood-club", "5w", 205, 80, "2026-05-01"),
        stock("seveniron-club", "7i", 150, 80, "2026-05-01"),
        stock("eightiron-club", "8i", 140, 80, "2026-05-01"),
        stock("nineiron-club", "9i", 125, 80, "2026-05-01"),
        stock("retired-driver-club", "driver", 320, 80, "2026-05-01"),
      ],
    });
    const ids = achievementIds(result.unlocks);
    const firstGood = result.unlocks.find((unlock) => unlock.achievementId === "benchmark_first_good");
    const goodBag = result.unlocks.find((unlock) => unlock.achievementId === "benchmark_bag_good");
    const driverGood = result.unlocks.find((unlock) => unlock.achievementId === "club_driver_benchmark_good");

    expect(ids).toContain("benchmark_first_average");
    expect(ids).toContain("benchmark_first_good");
    expect(ids).toContain("benchmark_bag_average");
    expect(ids).toContain("benchmark_bag_good");
    expect(ids).toContain("club_driver_benchmark_beginner");
    expect(ids).toContain("club_driver_benchmark_average");
    expect(ids).toContain("club_driver_benchmark_good");
    expect(ids).toContain("club_9i_benchmark_good");
    expect(ids).not.toContain("benchmark_first_advanced");
    expect(ids).not.toContain("benchmark_first_tour");
    expect(ids).not.toContain("benchmark_bag_advanced");
    expect(ids).not.toContain("club_driver_benchmark_advanced");
    expect(ids).not.toContain("club_driver_benchmark_tour");
    expect(firstGood?.metadata).toMatchObject({ benchmarkLevel: "Good", actualLevel: "Good", clubName: "Driver" });
    expect(driverGood?.metadata).toMatchObject({ benchmarkLevel: "Good", clubName: "Driver", targetYd: 250, carryYd: 250 });
    expect(goodBag?.metadata).toMatchObject({ benchmarkLevel: "Good", benchmarkClubCount: 5, benchmarkAverageLevel: 2 });
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
    expect(ids).toContain("scramble_day");
  });

  it("unlocks round short-game sand and up-and-down achievements", () => {
    const holes: RoundScorecardHole[] = [
      {
        holeNumber: 1,
        par: 4,
        yards: 380,
        score: 4,
        putts: 1,
        penalties: 0,
        fairwayHit: true,
        gir: false,
        chipShots: 1,
        greensideSandShots: 1,
      },
      {
        holeNumber: 2,
        par: 4,
        yards: 390,
        score: 4,
        putts: 1,
        penalties: 0,
        fairwayHit: true,
        gir: false,
        chipShots: 1,
        greensideSandShots: 0,
      },
      {
        holeNumber: 3,
        par: 4,
        yards: 395,
        score: 4,
        putts: 1,
        penalties: 0,
        fairwayHit: true,
        gir: false,
        chipShots: 1,
        greensideSandShots: 0,
      },
    ];
    const result = evaluateRoundScorecardAchievements(makeSession({ scorecardJson: holes }));
    const ids = achievementIds(result.unlocks);

    expect(ids).toContain("bunker_tool");
    expect(ids).toContain("sand_save");
    expect(ids).toContain("up_and_down");
    expect(ids).toContain("scramble_day");
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
