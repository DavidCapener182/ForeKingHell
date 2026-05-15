import { describe, expect, it } from "vitest";

import {
  buildAiCoachPayload,
  buildCoachPrompt,
  parseAiCoachSummary,
} from "@/lib/ai-coach-summary";
import type { CoachSummary } from "@/lib/coach";

describe("AI coach summary helpers", () => {
  it("builds a compact payload without raw shot rows", () => {
    const payload = buildAiCoachPayload(fakeCoachSummary());

    expect(payload.productName).toBe("ForeKingHell");
    expect(payload.focusClub?.clubName).toBe("Driver");
    expect(payload.totals.cleanShots).toBe(84);
    expect(JSON.stringify(payload)).not.toContain("sourceRawJson");
  });

  it("builds coach and asset prompts from summary metrics", () => {
    const payload = buildAiCoachPayload(fakeCoachSummary());

    expect(buildCoachPrompt(payload)).toContain("Return strict JSON only");
    expect(buildCoachPrompt(payload)).toContain("Driver");
    expect(buildCoachPrompt(payload)).toContain("ForeKingHell");
  });

  it("parses strict JSON coach output", () => {
    const parsed = parseAiCoachSummary(`{
      "headline": "Driver is playable, but protect the left miss.",
      "coachNote": "Keep the tee routine stable and work on direction before speed.",
      "practicePlan": ["Warm up", "Run the guardrail drill", "Finish with stock shots"],
      "watchOut": "Do not chase max carry today.",
      "confidence": "high"
    }`);

    expect(parsed.confidence).toBe("high");
    expect(parsed.practicePlan).toHaveLength(3);
  });
});

function fakeCoachSummary() {
  return {
    headline: "Driver is the next practice priority.",
    subhead: "Direction control is the main signal.",
    nextPriority: null,
    focusArea: "direction",
    signals: [{ label: "Carry", value: "+8 yd", detail: "Latest 30 vs first 30", tone: "green" }],
    sessionPlan: [{ title: "Driver block", detail: "Hit 10 no-left balls.", duration: "20 min", tone: "pink" }],
    trainingImpact: [
      {
        clubId: "driver-id",
        clubName: "Driver",
        issueLabel: "Direction control",
        status: "better",
        headline: "Driver improved after the latest session",
        detail: "Average offline tightened after the latest session.",
        tone: "green",
        metrics: [],
      },
    ],
    clubCards: [
      {
        clubId: "driver-id",
        clubType: "driver",
        clubName: "Driver",
        brandModel: "TaylorMade Qi10",
        issue: "direction",
        issueLabel: "Direction control",
        trustIndex: 72,
        sampleSize: 41,
        stockCarryYd: 205,
        usualMiss: "Left",
        playableRate: 62,
        launchWindow: { low: 13, high: 17 },
        drill: "Hit 10 balls with a hard left boundary.",
        reason: "62% playable rate with a left miss tendency.",
        tone: "pink",
      },
    ],
    summary: {
      totals: {
        clubs: 9,
        shots: 160,
        trackedCleanShots: 84,
        averageTrust: 64,
        averagePlayableRate: 58,
      },
      signals: [],
      trends: [],
      practicePlan: [],
      bestSignal: null,
      coachSummary: [],
      dataGaps: [],
      trustLadder: [],
      clubRows: [],
      journey: [],
      rankings: {
        mostTrusted: null,
        mostImproved: null,
        needsWork: null,
        mostVolatile: null,
      },
    },
  } as CoachSummary;
}
