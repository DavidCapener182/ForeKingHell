import { describe, expect, it } from "vitest";

import {
  adaptPracticePlanAfterBlock,
  buildPracticePriorityList,
  canImportedSessionReviewPracticePlan,
  comparePlanWithShotRows,
  comparePlanWithShotSummaries,
  evaluatePracticePlanAgainstImportedSession,
  generatePracticePlan,
  practicePlannerAchievementCandidateIds,
  scoreCompletedPractice,
  scorePracticePlanSessionMatch,
  selectPracticePlannerInitialSavedPlan,
  shouldAutoLinkPracticePlanMatch,
  type ImportedPracticeSessionSummary,
  type PracticePlan,
  type PracticePlannerContext,
  type SavedPracticePlan,
} from "@/lib/practice-planner";

describe("practice planner", () => {
  it("opens the result linked to the latest import before an older unfinished plan", () => {
    const latestResult = savedPlanRecord({
      id: "latest-result",
      status: "analysed",
      sourceSessionId: "latest-session",
      result: {
        verdict: "Incomplete signal",
        nextAction: "Repeat the main priority.",
        practiceScore: 14,
        comparison: null,
      },
    });
    const staleOpenPlan = savedPlanRecord({
      id: "stale-open",
      status: "awaiting_import",
      sourceSessionId: null,
      result: null,
    });

    expect(
      selectPracticePlannerInitialSavedPlan([latestResult, staleOpenPlan], "latest-session")?.id,
    ).toBe("latest-result");
  });

  it("falls back to the newest unfinished plan when the latest import has no result", () => {
    const staleOpenPlan = savedPlanRecord({
      id: "stale-open",
      status: "awaiting_import",
      sourceSessionId: null,
      result: null,
    });

    expect(selectPracticePlannerInitialSavedPlan([staleOpenPlan], "unmatched-session")?.id).toBe(
      "stale-open",
    );
  });

  it("creates an exact 30-ball range plan", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 30,
      timeMinutes: 30,
      energy: "normal",
      intent: "latest_weakness",
    });

    expect(plan.blocks).toHaveLength(3);
    expect(totalBalls(plan)).toBe(30);
  });

  it("creates an 80-ball range plan with warm-up, main priority and transfer", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });

    expect(totalBalls(plan)).toBe(80);
    expect(plan.blocks.some((block) => block.type === "warmup")).toBe(true);
    expect(plan.blocks.some((block) => block.title.toLowerCase().includes("main priority"))).toBe(
      true,
    );
    expect(plan.blocks.some((block) => block.type === "random")).toBe(true);
  });

  it("adds a separate no-ball speed block without losing any of an 80-ball range plan", () => {
    const plannerContext = context();
    plannerContext.speed.readinessStatus = "ready";
    plannerContext.speed.readinessLabel = "READY";
    plannerContext.speed.projectCoachMessage =
      "Ball speed is the next ingredient; carry remains the outcome.";
    const plan = generatePracticePlan(plannerContext, {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "speed",
    });

    expect(totalBalls(plan)).toBe(80);
    expect(plan.summary).toContain("12 no-ball swings");
    expect(
      plan.blocks.find((block) => block.title === "R-Speed ceiling block")?.ballCount,
    ).toBeNull();
    expect(plan.blocks.some((block) => block.title === "Driver transfer")).toBe(true);
    expect(plan.blocks.at(-1)?.title).toBe("Random course finish");
  });

  it("removes maximum-speed work when Speed Readiness says recover", () => {
    const plannerContext = context();
    plannerContext.speed.readinessStatus = "recover";
    plannerContext.speed.readinessLabel = "RECOVER";
    plannerContext.speed.recommendation = "Technical Driver only — no maximum-speed work today.";
    const plan = generatePracticePlan(plannerContext, {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "speed",
    });

    expect(totalBalls(plan)).toBe(80);
    expect(plan.blocks.some((block) => block.title === "Speed work removed")).toBe(true);
    expect(plan.blocks.some((block) => block.title === "R-Speed ceiling block")).toBe(false);
    expect(plan.blocks.some((block) => block.title === "Technical Driver")).toBe(true);
  });

  it("uses a controlled baseline rather than maximum blocks while readiness is building", () => {
    const plannerContext = context();
    plannerContext.speed.readinessStatus = "build";
    plannerContext.speed.readinessLabel = "BUILD";
    plannerContext.speed.recommendation =
      "Build the baseline with one controlled speed block and transfer shots.";
    const plan = generatePracticePlan(plannerContext, {
      sessionType: "speed",
      ballCount: null,
      timeMinutes: 20,
      energy: "normal",
      intent: "speed",
    });

    expect(plan.title).toBe("Speed transfer baseline");
    expect(plan.blocks.some((block) => block.title === "Controlled speed baseline")).toBe(true);
    expect(plan.blocks.map((block) => `${block.title} ${block.drill}`).join(" ")).not.toContain(
      "maximum",
    );
  });

  it("keeps high recent load away from overspeed work", () => {
    const plan = generatePracticePlan(context({ highRecentLoad: true }), {
      sessionType: "speed",
      ballCount: null,
      timeMinutes: 30,
      energy: "normal",
      intent: "speed",
    });

    expect(plan.title).toContain("Speed-Safe");
    expect(plan.blocks.map((block) => block.title).join(" ")).not.toContain("Overspeed");
  });

  it("does not over-prioritise low-confidence clubs unless they are roadmap items", () => {
    const withoutRoadmap = buildPracticePriorityList(
      context({ includeLowConfidenceRoadmap: false }),
      {
        sessionType: "range",
        energy: "normal",
        intent: "latest_weakness",
      },
    );
    const withRoadmap = buildPracticePriorityList(context({ includeLowConfidenceRoadmap: true }), {
      sessionType: "range",
      energy: "normal",
      intent: "latest_weakness",
    });

    expect(withoutRoadmap.findIndex((item) => item.clubType === "lw")).toBeGreaterThan(1);
    expect(withRoadmap.findIndex((item) => item.clubType === "lw")).toBeLessThan(
      withoutRoadmap.findIndex((item) => item.clubType === "lw"),
    );
  });

  it("creates a wedge ladder when wedge work is the priority", () => {
    const plan = generatePracticePlan(context({ latestOpportunity: "sw" }), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "scoring",
    });

    expect(plan.blocks.some((block) => block.title.toLowerCase().includes("wedge ladder"))).toBe(
      true,
    );
  });

  it("creates driver delivery work when driver is the priority", () => {
    const plan = generatePracticePlan(
      context({ driverRoadmap: true, latestOpportunity: "driver" }),
      {
        sessionType: "range",
        ballCount: 50,
        timeMinutes: 45,
        energy: "fresh",
        intent: "round_preparation",
      },
    );

    expect(plan.blocks.some((block) => block.title.toLowerCase().includes("driver delivery"))).toBe(
      true,
    );
  });

  it("generates every supported session type", () => {
    for (const sessionType of [
      "range",
      "short_game",
      "speed",
      "putting",
      "course_warmup",
      "mixed",
    ] as const) {
      const plan = generatePracticePlan(context(), {
        sessionType,
        ballCount: sessionType === "short_game" || sessionType === "putting" ? null : 50,
        timeMinutes: 45,
        energy: "normal",
        intent: sessionType === "speed" ? "speed" : "latest_weakness",
        facility: { bunker: true, puttingGreen: true, distanceAvailableFt: 30 },
      });

      expect(plan.blocks.length).toBeGreaterThan(0);
      expect(plan.title).toBeTruthy();
    }
  });

  it("compares plan blocks against imported shot summaries", () => {
    const plan = generatePracticePlan(
      context({ latestOpportunity: "driver", driverRoadmap: true }),
      {
        sessionType: "range",
        ballCount: 50,
        timeMinutes: 45,
        energy: "normal",
        intent: "round_preparation",
      },
    );
    const driverBlock = plan.blocks.find(
      (block) => block.clubs.includes("driver") && block.type === "technical",
    );

    expect(driverBlock).toBeTruthy();

    const comparison = comparePlanWithShotSummaries(plan, "session-1", [
      {
        clubType: "driver",
        shotCount: driverBlock?.ballCount ?? 10,
        playableRate: 90,
        offlineAverageYd: 12,
        carryAverageYd: 220,
      },
    ]);

    expect(comparison.decisions.some((decision) => decision.decision === "move_down")).toBe(true);
  });

  it("matches an uploaded club count to the planned practice block", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const fiveWoodBlock = plan.blocks.find(
      (block) => block.clubs.includes("5w") && block.ballCount === 20,
    );

    expect(fiveWoodBlock).toBeTruthy();

    const comparison = comparePlanWithShotSummaries(plan, "session-1", [
      {
        clubType: "5w",
        shotCount: 20,
        playableRate: 80,
        offlineAverageYd: 11,
        carryAverageYd: 180,
      },
    ]);
    const decision = comparison.decisions.find((item) => item.blockId === fiveWoodBlock?.id);

    expect(decision).toMatchObject({
      actualBalls: 20,
      matchedPlannedVolume: true,
      decision: "move_down",
    });
    expect(decision?.actual).toContain("20/20 matching shots");
  });

  it("matches latest-session evidence when planned club casing differs from imported shots", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const fiveWoodBlock = plan.blocks.find(
      (block) => block.clubs.includes("5w") && block.ballCount === 20,
    );

    expect(fiveWoodBlock).toBeTruthy();

    const mixedCasePlan: PracticePlan = {
      ...plan,
      blocks: plan.blocks.map((block) =>
        block.id === fiveWoodBlock?.id ? { ...block, clubs: ["5W"] } : block,
      ),
    };
    const rows = shotRows("5w", 1, 1, { offlineYd: 2, launchDirectionDeg: 1 }).map((row) => ({
      ...row,
      shotNumber: null,
    }));
    const comparison = comparePlanWithShotRows(
      mixedCasePlan,
      "session-1",
      {
        shotCount: rows.length,
        sessionType: "range",
        dateLabel: "2026-07-01",
        clubTypes: ["5w"],
        shotRows: rows,
      },
      45,
    );
    const decision = comparison.decisions.find((item) => item.blockId === fiveWoodBlock?.id);

    expect(decision?.actualBalls).toBe(1);
    expect(decision?.matchedPlannedVolume).toBe(false);
    expect(decision?.actual).toContain("from 1/20 matching shots");
  });

  it("awards practice achievements from uploaded drill wins", () => {
    const ids = practicePlannerAchievementCandidateIds({
      event: "completed",
      planCount: 2,
      completedCount: 1,
      score: {
        score: 77,
        completionPercent: 96,
        verdict: "Practice landed",
        nextAction: "Maintain the main priority.",
        mainPriority: "mixed",
        transfer: "strong",
      },
      planBlockCount: 5,
      blockResults: [
        { blockId: "block-1", completionStatus: "complete", actualBalls: 10, passed: true },
        { blockId: "block-2", completionStatus: "complete", actualBalls: 10, passed: true },
        { blockId: "block-3", completionStatus: "complete", actualBalls: 10, passed: true },
        { blockId: "block-4", completionStatus: "complete", actualBalls: 10, passed: true },
        { blockId: "block-5", completionStatus: "complete", actualBalls: 10, passed: true },
      ],
    });

    expect(ids).toEqual(
      expect.arrayContaining([
        "practice_planner_first_completed",
        "practice_planner_drill_winner",
        "practice_planner_three_drills_won",
        "practice_planner_five_drills_won",
        "practice_planner_clean_card",
      ]),
    );
  });

  it("scores an 82-shot import as a high-confidence match for an 80-ball plan", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const match = scorePracticePlanSessionMatch(
      savedPlan(plan),
      importedSession(82, [
        ["5w", 20],
        ["5i", 15],
        ["sw", 15],
        ["driver", 12],
        ["pw", 10],
        ["9i", 10],
      ]),
    );

    expect(match.score).toBeGreaterThanOrEqual(75);
    expect(shouldAutoLinkPracticePlanMatch(match.score)).toBe(true);
    expect(match.breakdown.ballCountScore).toBeGreaterThanOrEqual(19);
  });

  it("does not auto-link a low-confidence import", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const match = scorePracticePlanSessionMatch(
      savedPlan(plan),
      importedSession(24, [["putter", 24]], {
        sessionType: "round",
        plannedAt: "2026-06-20T12:00:00.000Z",
        sessionDate: "2026-07-01T12:00:00.000Z",
      }),
    );

    expect(match.score).toBeLessThan(75);
    expect(shouldAutoLinkPracticePlanMatch(match.score)).toBe(false);
  });

  it("auto-links partial planned-club evidence from the latest upload", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const match = scorePracticePlanSessionMatch(savedPlan(plan), importedSession(5, [["5i", 5]]));

    expect(match.score).toBeLessThan(75);
    expect(match.score).toBeGreaterThanOrEqual(35);
    expect(shouldAutoLinkPracticePlanMatch(match.score)).toBe(false);
    expect(shouldAutoLinkPracticePlanMatch(match.score, true)).toBe(true);
  });

  it("does not reuse an already-uploaded session for a newly created practice", () => {
    const plan = savedPlan(
      generatePracticePlan(context(), {
        sessionType: "range",
        ballCount: 80,
        timeMinutes: 45,
        energy: "normal",
        intent: "latest_weakness",
      }),
    );
    const previousUpload = importedSession(82, [["5w", 20]], {
      uploadedAt: "2026-07-01T12:30:00.000Z",
    });
    const nextUpload = importedSession(82, [["5w", 20]], {
      uploadedAt: "2026-07-01T12:45:00.000Z",
    });
    const nextPractice = {
      ...plan,
      plannedAt: "2026-07-01T12:40:00.000Z",
    };

    expect(canImportedSessionReviewPracticePlan(nextPractice, previousUpload)).toBe(false);
    expect(canImportedSessionReviewPracticePlan(nextPractice, nextUpload)).toBe(true);
  });

  it("splits ordered shots into planned blocks", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 30,
      timeMinutes: 30,
      energy: "normal",
      intent: "latest_weakness",
    });
    const rows = [
      ...shotRows("pw", 1, 8, { offlineYd: 5, launchDirectionDeg: 1 }),
      ...shotRows("5w", 9, 14, { offlineYd: 8, launchDirectionDeg: 2 }),
      ...shotRows("5w", 23, 8, { offlineYd: 10, launchDirectionDeg: 2 }),
    ];
    const comparison = comparePlanWithShotRows(
      plan,
      "session-1",
      {
        shotCount: rows.length,
        sessionType: "range",
        dateLabel: "2026-07-01",
        clubTypes: ["pw", "5w"],
        shotRows: rows,
      },
      90,
    );

    expect(comparison.scoringMode).toBe("ordered");
    expect(comparison.decisions[0]?.actualBalls).toBe(8);
    expect(comparison.decisions[1]?.scoringMode).toBe("ordered");
  });

  it("falls back to club-level scoring when shot order is missing", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const rows = shotRows("5w", 1, 20, { offlineYd: 8, launchDirectionDeg: 2 }).map((row) => ({
      ...row,
      shotNumber: null,
    }));
    const comparison = comparePlanWithShotRows(
      plan,
      "session-1",
      {
        shotCount: rows.length,
        sessionType: "range",
        dateLabel: "2026-07-01",
        clubTypes: ["5w"],
        shotRows: rows,
      },
      80,
    );
    const fiveWoodDecision = comparison.decisions.find((decision) => decision.title.includes("5W"));

    expect(comparison.scoringMode).toBe("aggregate");
    expect(fiveWoodDecision?.confidence).toBe("medium");
    expect(fiveWoodDecision?.actualBalls).toBe(20);
  });

  it("excludes top-tagged imported rows from clean plan matching", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const rows = shotRows("5w", 1, 20, { offlineYd: 8, launchDirectionDeg: 2 }).map(
      (row, index) => ({
        ...row,
        shotNumber: null,
        qualityTag: index >= 18 ? "top" : null,
      }),
    );
    const comparison = comparePlanWithShotRows(
      plan,
      "session-1",
      {
        shotCount: rows.length,
        sessionType: "range",
        dateLabel: "2026-07-01",
        clubTypes: ["5w"],
        shotRows: rows,
      },
      80,
    );
    const fiveWoodDecision = comparison.decisions.find((decision) => decision.title.includes("5W"));

    expect(comparison.planVsActual.actualShots).toBe(18);
    expect(fiveWoodDecision?.actualBalls).toBe(18);
    expect(fiveWoodDecision?.matchedPlannedVolume).toBe(false);
    expect(fiveWoodDecision?.actual).toContain("18/20 matching shots");
  });

  it("uses only included and restored shots as practice-plan evidence", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const excludedStatuses = [
      "suggested_exclusion",
      "user_excluded",
      "calibration",
      "warm_up",
      "launch_monitor_error",
    ] as const;
    const rows = [
      ...shotRows("5w", 1, 1, { offlineYd: 8, launchDirectionDeg: 2 }).map((row) => ({
        ...row,
        reviewStatus: "included" as const,
      })),
      ...shotRows("5w", 2, 1, { offlineYd: 8, launchDirectionDeg: 2 }).map((row) => ({
        ...row,
        reviewStatus: "restored" as const,
        qualityTag: "bad_data",
      })),
      ...excludedStatuses.flatMap((reviewStatus, index) =>
        shotRows("5w", index + 3, 1, { offlineYd: 2, launchDirectionDeg: 0 }).map((row) => ({
          ...row,
          reviewStatus,
        })),
      ),
    ];
    const comparison = comparePlanWithShotRows(
      plan,
      "session-1",
      {
        shotCount: rows.length,
        sessionType: "range",
        dateLabel: "2026-07-01",
        clubTypes: ["5w"],
        shotRows: rows,
      },
      80,
      { scoringMode: "aggregate" },
    );
    const fiveWoodDecision = comparison.decisions.find((decision) => decision.title.includes("5W"));

    expect(comparison.planVsActual.actualShots).toBe(2);
    expect(fiveWoodDecision?.actualBalls).toBe(2);
  });

  it("scores a short latest-session upload against the planned club and pulls the score down", () => {
    const plannerContext = context();
    plannerContext.progress.priorities = [
      priority("5w", 80),
      priority("5i", 76),
      priority("sw", 70),
    ];
    const plan = generatePracticePlan(plannerContext, {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const rows = shotRows("5i", 1, 5, { offlineYd: 8, launchDirectionDeg: 2 });
    const comparison = comparePlanWithShotRows(
      plan,
      "session-1",
      {
        shotCount: rows.length,
        sessionType: "range",
        dateLabel: "2026-07-01",
        clubTypes: ["5i"],
        shotRows: rows,
      },
      45,
    );
    const fiveIronDecision = comparison.decisions.find((decision) =>
      decision.title.toLowerCase().includes("5i"),
    );
    const score = scoreCompletedPractice(
      plan,
      {
        completionStatus: "partial",
        actualBalls: rows.length,
        actualMinutes: 45,
        sourceSessionId: "session-1",
        blockResults: comparison.decisions.map((decision) => ({
          blockId: decision.blockId,
          completionStatus: decision.matchedPlannedVolume
            ? "complete"
            : decision.actualBalls > 0
              ? "partial"
              : "missed",
          actualBalls: decision.actualBalls,
          actualMinutes: 0,
          score: decision.matchedPlannedVolume ? 100 : decision.actualBalls > 0 ? 25 : 0,
          passed: decision.result === "passed",
        })),
      },
      comparison,
    );

    expect(comparison.scoringMode).toBe("aggregate");
    expect(fiveIronDecision).toMatchObject({
      actualBalls: 5,
      matchedPlannedVolume: false,
      result: "insufficient_data",
    });
    expect(fiveIronDecision?.actual).toContain("5/15 matching shots");
    expect(fiveIronDecision?.summary).toContain("5 matching shots found");
    expect(score.score).toBeLessThan(35);
  });

  it("builds latest-session review from uploaded shots without manual scoring", () => {
    const plannerContext = context();
    plannerContext.progress.priorities = [
      priority("5w", 80),
      priority("5i", 76),
      priority("sw", 70),
    ];
    const plan = generatePracticePlan(plannerContext, {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const review = evaluatePracticePlanAgainstImportedSession(
      plan,
      importedSession(5, [["5i", 5]]),
      45,
    );
    const fiveIronDecision = review.comparison.decisions.find((decision) =>
      decision.title.toLowerCase().includes("5i"),
    );

    expect(review.comparison.sourceSessionId).toBe("session-1");
    expect(review.comparison.planVsActual.actualShots).toBe(5);
    expect(fiveIronDecision?.actualBalls).toBe(5);
    expect(fiveIronDecision?.matchedPlannedVolume).toBe(false);
    expect(review.score.score).toBeLessThan(35);
  });

  it("scores selected imports by matching planned clubs even when shot order exists", () => {
    const plannerContext = context();
    plannerContext.progress.priorities = [
      priority("5w", 80),
      priority("5i", 76),
      priority("sw", 70),
    ];
    const plan = generatePracticePlan(plannerContext, {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const selectedReview = evaluatePracticePlanAgainstImportedSession(
      plan,
      importedSession(30, [
        ["driver", 5],
        ["sw", 5],
        ["5w", 10],
        ["5i", 10],
      ]),
      92,
      { scoringMode: "aggregate" },
    );
    const fiveWoodDecision = selectedReview.comparison.decisions.find((decision) =>
      decision.title.toLowerCase().includes("5w"),
    );
    const fiveIronDecision = selectedReview.comparison.decisions.find((decision) =>
      decision.title.toLowerCase().includes("5i"),
    );
    const wedgeDecision = selectedReview.comparison.decisions.find((decision) =>
      decision.title.toLowerCase().includes("sw"),
    );

    expect(selectedReview.comparison.scoringMode).toBe("aggregate");
    expect(fiveWoodDecision?.actualBalls).toBe(10);
    expect(fiveWoodDecision?.actual).toContain("10/20 matching shots");
    expect(fiveIronDecision?.actualBalls).toBe(10);
    expect(fiveIronDecision?.actual).toContain("10/15 matching shots");
    expect(wedgeDecision?.actualBalls).toBeGreaterThan(0);
  });

  it("block results use shot data rather than a manual score", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 80,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const rows = shotRows("5w", 1, 20, { offlineYd: 45, launchDirectionDeg: 12 }).map((row) => ({
      ...row,
      shotNumber: null,
    }));
    const comparison = comparePlanWithShotRows(
      plan,
      "session-1",
      {
        shotCount: rows.length,
        sessionType: "range",
        dateLabel: "2026-07-01",
        clubTypes: ["5w"],
        shotRows: rows,
      },
      80,
    );
    const fiveWoodDecision = comparison.decisions.find((decision) => decision.title.includes("5W"));

    expect(fiveWoodDecision?.actualBalls).toBe(20);
    expect(fiveWoodDecision?.result).toBe("failed");
    expect(fiveWoodDecision?.metrics).toMatchObject({ bigMisses: 20 });
  });

  it("scores completed practice and adapts the next block after a miss", () => {
    const plan = generatePracticePlan(context(), {
      sessionType: "range",
      ballCount: 50,
      timeMinutes: 45,
      energy: "normal",
      intent: "latest_weakness",
    });
    const blockResults = plan.blocks.map((block, index) => ({
      blockId: block.id,
      completionStatus: "complete" as const,
      actualBalls: block.ballCount,
      actualMinutes: block.timeMinutes,
      score: index === 1 ? 2 : block.scoringRules.target,
      passed: index !== 1,
    }));
    const score = scoreCompletedPractice(plan, {
      completionStatus: "complete",
      actualBalls: totalBalls(plan),
      actualMinutes: 45,
      blockResults,
    });
    const adapted = adaptPracticePlanAfterBlock(plan, blockResults[1]);

    expect(score.score).toBeGreaterThan(50);
    expect(adapted.summary).toContain("Adaptive note");
  });
});

function totalBalls(plan: { blocks: Array<{ ballCount: number | null }> }) {
  return plan.blocks.reduce((total, block) => total + (block.ballCount ?? 0), 0);
}

function savedPlan(plan: PracticePlan): SavedPracticePlan {
  return {
    id: "plan-1",
    title: plan.title,
    sessionType: plan.sessionType,
    status: "awaiting_import",
    totalBalls: plan.totalBalls,
    timeMinutes: plan.estimatedTimeMinutes,
    focusClubs: plan.focusClubs,
    plannedAt: "2026-07-01T10:00:00.000Z",
    completedAt: null,
    score: null,
    matchConfidence: null,
    matchReason: null,
    summary: plan.summary,
    generation: plan.generation,
    sourceSessionId: null,
    blocks: plan.blocks.map((block) => ({ ...block, dbId: `${block.id}-db` })),
    result: null,
  };
}

function importedSession(
  shotCount: number,
  clubCounts: Array<[string, number]>,
  options: {
    sessionType?: string;
    plannedAt?: string;
    sessionDate?: string;
    uploadedAt?: string;
  } = {},
): ImportedPracticeSessionSummary {
  const rows = clubCounts.flatMap(([clubType, count], index) =>
    shotRows(clubType, index * 100 + 1, count, { offlineYd: 8, launchDirectionDeg: 2 }),
  );

  return {
    id: "session-1",
    sourceType: "rapsodo",
    sessionType: options.sessionType ?? "range",
    sessionDate: new Date(options.sessionDate ?? "2026-07-01T12:00:00.000Z"),
    uploadedAt: new Date(options.uploadedAt ?? options.sessionDate ?? "2026-07-01T12:00:00.000Z"),
    shotCount,
    rawShotCount: shotCount,
    excludedShotCount: 0,
    clubTypes: clubCounts.map(([clubType]) => clubType),
    clubSummaries: clubCounts.map(([clubType, count]) => ({
      clubType,
      shotCount: count,
      playableRate: 80,
      offlineAverageYd: 8,
      carryAverageYd: 150,
    })),
    shotRows: rows,
  };
}

function shotRows(
  clubType: string,
  startNumber: number,
  count: number,
  values: { offlineYd: number; launchDirectionDeg: number },
) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${clubType}-${startNumber + index}`,
    clubType,
    shotNumber: startNumber + index,
    shotAt: new Date(`2026-07-01T12:${String(index).padStart(2, "0")}:00.000Z`),
    carryYd: 150,
    totalYd: 165,
    offlineYd: values.offlineYd,
    launchDirectionDeg: values.launchDirectionDeg,
    clubPathDeg: 2,
    faceAngleDeg: 1,
    ballSpeedMph: 120,
    clubSpeedMph: 88,
    qualityTag: null,
  }));
}

function context(
  options: {
    highRecentLoad?: boolean;
    includeLowConfidenceRoadmap?: boolean;
    latestOpportunity?: string;
    driverRoadmap?: boolean;
  } = {},
): PracticePlannerContext {
  const priorities = [
    options.driverRoadmap ? priority("driver", 82) : priority("5w", 80),
    priority("sw", 70),
    priority("5i", 62),
  ];

  if (options.includeLowConfidenceRoadmap) {
    priorities.unshift(priority("lw", 90));
  }

  return {
    generatedAt: "2026-07-01T12:00:00.000Z",
    latestPractice: {
      sessionId: "latest-session",
      dateLabel: "1 Jul 2026",
      bestPerformer: "7i",
      biggestOpportunity: options.latestOpportunity ?? "5w",
      scoringIssue: "5W start line is still volatile.",
      straightRate: 45,
      playableRate: 66,
      offlineAverageYd: 18,
      clubs: [],
    },
    progress: {
      priorities,
      trustLadder: [],
      mostVolatile: "5w",
      weakestSignal: "sw",
      currentForm: "driver",
    },
    bag: {
      clubs: [
        club("driver", 63, 64, 14, 28),
        club("5w", 52, 48, 18, 35),
        club("5i", 58, 54, 12, 22),
        club("7i", 78, 82, 32, 10),
        club("pw", 74, 80, 26, 8, 120),
        club("gw", 62, 66, 12, 9, 100),
        club("sw", 55, 60, 10, 11, 90),
        club("lw", 18, 18, 2, 18, 65),
      ],
      issues: ["5W volatile", "SW scoring window needs more data"],
      wedgeMatrix: [
        {
          id: "sw",
          clubType: "sw",
          label: "SW",
          brandModel: "SW test",
          isSuggested: false,
          matrixScore: 70,
          fullCarryYd: 90,
          rows: [
            {
              key: "full",
              label: "Full",
              carryYd: 90,
              sampleSize: 8,
              status: "trusted",
              detail: "",
              tone: "green",
            },
            {
              key: "threeQuarter",
              label: "3/4",
              carryYd: 77,
              sampleSize: 0,
              status: "target",
              detail: "",
              tone: "sky",
            },
            {
              key: "half",
              label: "Half",
              carryYd: 63,
              sampleSize: 0,
              status: "target",
              detail: "",
              tone: "sky",
            },
          ],
        },
      ],
    },
    trainingLoad: {
      statusKey: options.highRecentLoad ? "load_high" : "balanced",
      statusLabel: options.highRecentLoad ? "Poor form" : "Good",
      advice: options.highRecentLoad
        ? "Avoid speed training and keep practice technical."
        : "A normal practice session should keep momentum.",
      recentLoad: options.highRecentLoad ? 135 : 80,
      golfForm: options.highRecentLoad ? 88 : 108,
      recommendation: options.highRecentLoad
        ? "Technical practice only"
        : "Technical practice recommended",
      highRecentLoad: Boolean(options.highRecentLoad),
    },
    speed: {
      currentSpeedMph: 89,
      targetSpeedMph: 97,
      recommendation: "Add one short speed session if recovery feels normal.",
      priority: "Medium",
    },
    scoring: {
      weakestCategory: "approach",
      penaltyPattern: "tee",
    },
  };
}

function priority(clubType: string, score: number) {
  return {
    clubId: `${clubType}-id`,
    clubType,
    title: `Stabilise ${clubType.toUpperCase()} start line`,
    reason: `${clubType.toUpperCase()} needs a tighter start window.`,
    drill: "Start-line gate.",
    score,
    priorityLabel: "High priority" as const,
    tone: "amber" as const,
  };
}

function club(
  clubType: string,
  trustIndex: number,
  confidenceScore: number,
  sampleSize: number,
  offlineAverageYd: number,
  stockCarryYd: number | null = null,
) {
  return {
    clubId: `${clubType}-id`,
    clubType,
    label: clubType.toUpperCase(),
    stockCarryYd,
    trustIndex,
    confidenceScore,
    confidenceLabel: confidenceScore > 70 ? "Reliable" : "Developing",
    sampleSize,
    playableRate: trustIndex,
    offlineAverageYd,
    bigMissRate: Math.max(4, Math.round(offlineAverageYd * 0.8)),
    volatilityScore: offlineAverageYd * 1.8,
    practiceTitle: `${clubType} practice`,
    practiceDrill: "Start-line gate.",
  };
}

function savedPlanRecord(
  overrides: Pick<SavedPracticePlan, "id" | "status" | "sourceSessionId" | "result">,
): SavedPracticePlan {
  return {
    id: overrides.id,
    title: "Test plan",
    sessionType: "range",
    status: overrides.status,
    totalBalls: 100,
    timeMinutes: 45,
    focusClubs: ["driver"],
    plannedAt: "2026-07-08T12:00:00.000Z",
    completedAt: null,
    score: overrides.result?.practiceScore ?? null,
    matchConfidence: null,
    matchReason: null,
    summary: "Test plan summary",
    generation: {
      source: "rules",
      label: "Rules",
      model: null,
      cached: false,
      creditsCharged: 0,
      creditsRemaining: null,
      note: null,
    },
    sourceSessionId: overrides.sourceSessionId,
    blocks: [],
    result: overrides.result,
  };
}
