import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveTodayPrimaryState, type TodayRecommendation } from "@/lib/today-primary-state";

const recommendation: TodayRecommendation = {
  title: "Practise 7i dispersion control",
  reason: "7i is the clearest current opportunity.",
  clubLabel: "7i",
  clubType: "7i",
  issue: "Dispersion control",
  confidence: "Moderate",
  minutes: 45,
  evidenceLabel: "10 measured shots",
  bagConfidence: "Moderate",
  explanation: "Measured evidence points to a 45-minute 7i session.",
};

const review = {
  dateLabel: "2026-08-14T09:00:00.000Z",
  sessions: [{ id: "session-1" }],
  shots: [{}],
  overall: { title: "Better than baseline", summary: "The pattern tightened." },
};

describe("Today primary state priority", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps active practice ahead of a review-ready session and active round", () => {
    vi.setSystemTime(new Date("2026-08-14T12:00:00.000Z"));
    const state = resolveTodayPrimaryState({
      currentPlan: {
        id: "plan-1",
        title: "Driver start-line block",
        status: "active",
        timeMinutes: 30,
      },
      activeRound: { id: "round-1", courseName: "Royal Lytham" },
      recommendation,
      latestData: review,
    });

    expect(state.eyebrow).toBe("Active Range Mode");
    expect(state.action).toBe("Continue practice");
  });

  it("keeps an evidence-needed plan ahead of a fresh session review", () => {
    vi.setSystemTime(new Date("2026-08-14T12:00:00.000Z"));
    const state = resolveTodayPrimaryState({
      currentPlan: {
        id: "plan-2",
        title: "Wedge ladder",
        status: "awaiting_import",
        timeMinutes: 40,
      },
      activeRound: null,
      recommendation,
      latestData: review,
    });

    expect(state.status).toBe("Evidence needed");
    expect(state.href).toContain("practicePlanId=plan-2");
  });

  it("keeps a fresh review ahead of an active round", () => {
    vi.setSystemTime(new Date("2026-08-14T12:00:00.000Z"));
    const state = resolveTodayPrimaryState({
      currentPlan: null,
      activeRound: { id: "round-1", courseName: "Royal Lytham" },
      recommendation,
      latestData: review,
    });

    expect(state.status).toBe("Review ready");
    expect(state.href).toBe("/sessions/session-1");
  });

  it("falls back to the measured practice recommendation", () => {
    const state = resolveTodayPrimaryState({
      currentPlan: null,
      activeRound: null,
      recommendation,
      latestData: null,
    });

    expect(state.eyebrow).toBe("Today’s recommendation");
    expect(state.action).toBe("Plan range session");
    expect(state.href).toContain("club=7i");
  });
});
