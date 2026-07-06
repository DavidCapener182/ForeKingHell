import { describe, expect, it } from "vitest";

import { buildAiCaddieBrief, type AiCaddieBriefInput } from "@/lib/ai-caddie-brief";

describe("AI Caddie Brief", () => {
  it("builds a structured practice brief from dashboard evidence", () => {
    const brief = buildAiCaddieBrief(input());

    expect(brief.schemaVersion).toBe(1);
    expect(brief.generatedFrom).toBe("rules-v1");
    expect(brief.title).toBe("Today's AI Caddie Brief");
    expect(brief.headline).toContain("7 iron");
    expect(brief.focusClub).toBe("7 iron");
    expect(brief.practice.durationMinutes).toBe(45);
    expect(brief.practice.blocks.some((block) => block.label === "Main block")).toBe(true);
    expect(brief.practice.ballCount).toBeGreaterThan(30);
    expect(brief.actions.primary).toEqual({
      label: "Start today's practice",
      href: "/practice?source=caddie&time=45&intent=latest_weakness#practice-plan",
    });
    expect(brief.actions.secondary.map((action) => action.label)).toEqual([
      "Why this?",
      "Change focus",
      "Mark complete",
    ]);
    expect(brief.dataUsed.map((item) => item.label)).toEqual([
      "Latest import",
      "Bag confidence",
      "Coach signal",
      "Data health",
      "Play context",
      "Practice plan",
    ]);
  });

  it("does not invent a diagnosis when no launch-monitor shots exist", () => {
    const brief = buildAiCaddieBrief(
      input({
        stats: { shotCount: 0, sessionCount: 0, roundCount: 0 },
        latestSession: null,
        coachPreview: null,
        bagSummary: {
          averageConfidence: 0,
          trustedClubCount: 0,
          mappedClubCount: 0,
          leastTrusted: null,
          mostTrusted: null,
        },
      }),
    );

    expect(brief.confidence).toBe("low");
    expect(brief.headline).toMatch(/Import one launch-monitor session/i);
    expect(brief.practice.ballCount).toBe(0);
    expect(brief.practice.successMetric).toBe("One imported session with confirmed club mapping.");
    expect(brief.dataUsed[0]).toMatchObject({
      label: "Latest import",
      status: "missing",
    });
    expect(brief.warnings.join(" ")).toMatch(/Shot sample is still small/i);
  });

  it("surfaces pending Rapsodo review without blocking the practice handoff", () => {
    const brief = buildAiCaddieBrief(
      input({
        rapsodoInbox: {
          pendingCount: 2,
          latest: { title: "Garage session", shotCount: 42 },
        },
      }),
    );

    expect(brief.actions.primary.href).toContain("/practice?");
    expect(brief.actions.secondary.map((action) => action.label)).toContain("Review import");
    expect(brief.warnings[0]).toMatch(/2 Rapsodo sessions still need review/i);
  });
});

function input(overrides: Partial<AiCaddieBriefInput> = {}): AiCaddieBriefInput {
  return {
    stats: { shotCount: 126, sessionCount: 7, roundCount: 2 },
    latestSession: {
      fileName: "Rapsodo July 6.csv",
      dateLabel: "6 Jul 2026",
      shotCount: 46,
      rawRowCount: 48,
    },
    rapsodoInbox: {
      pendingCount: 0,
      latest: null,
    },
    bagSummary: {
      averageConfidence: 72,
      trustedClubCount: 8,
      mappedClubCount: 11,
      leastTrusted: {
        label: "5 wood",
        playNumberYd: 208,
        confidenceScore: 42,
        sampleSize: 6,
        missLabel: "Right 18 yd",
        needsShots: 14,
      },
      mostTrusted: {
        label: "PW",
        confidenceScore: 88,
        sampleSize: 24,
      },
    },
    coachPreview: {
      clubName: "7 iron",
      issueLabel: "start line",
      reason:
        "7 iron has a right miss pattern, but carry distance is stable across the latest sample.",
      drill: "Use an alignment-stick gate for 10 starts, then hit stock shots to the same window.",
      trustIndex: 73,
      sampleSize: 18,
      stockCarryYd: 152,
      usualMiss: "Right 9 yd",
      playableRate: 0.68,
    },
    dataHealth: {
      metric: "82/100",
      status: "Ready",
      detail: "Mapped clubs and recent normalized shots are available.",
      score: 82,
    },
    playContextSummary: {
      recommendation: "Treat course-yardage calls as bay-backed until more outdoor shots land.",
      onCourseShots: 8,
      simulatorShots: 44,
      practiceBayShots: 74,
    },
    whatChanged: [
      {
        label: "7 iron dispersion",
        value: "6 yd tighter",
        detail: "Average left/right miss compared with the previous 30-day window.",
      },
    ],
    currentPracticePlan: null,
    ...overrides,
  };
}
