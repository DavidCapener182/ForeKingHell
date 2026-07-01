import { describe, expect, it } from "vitest";

import {
  inferPlayContext,
  normalizePlayContext,
  playContextEvidenceLabel,
} from "@/lib/play-context";

describe("play context helpers", () => {
  it("normalizes stale and display-shaped context values", () => {
    expect(normalizePlayContext("On Course")).toBe("on_course");
    expect(normalizePlayContext("practice-bay")).toBe("practice_bay");
    expect(normalizePlayContext("dark")).toBe("unknown");
  });

  it("infers course, simulator and practice-bay contexts from imported metadata", () => {
    expect(inferPlayContext({ sessionType: "real_round", title: "Saturday medal" })).toBe(
      "on_course",
    );
    expect(inferPlayContext({ sessionType: "simulated_course", providerKind: "simulation" })).toBe(
      "simulator",
    );
    expect(inferPlayContext({ source: "rapsodo", title: "Launch monitor range" })).toBe(
      "practice_bay",
    );
  });

  it("keeps evidence labels golfer-facing", () => {
    expect(playContextEvidenceLabel("on_course")).toBe("Outdoor truth");
    expect(playContextEvidenceLabel("simulator")).toBe("Simulator only");
  });
});
