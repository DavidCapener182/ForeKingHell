import { describe, expect, it } from "vitest";
import { comparisonReadiness } from "./comparison-readiness";
describe("comparison verdict readiness", () => {
  it("distinguishes absent observations from measured steady performance", () => {
    expect(comparisonReadiness(0, 30, "reliable")).toBe("missing");
    expect(comparisonReadiness(30, 0, "reliable")).toBe("missing");
  });
  it("keeps sparse or low-confidence deltas provisional despite large other samples", () => {
    expect(comparisonReadiness(3, 300, "reliable")).toBe("limited");
    expect(comparisonReadiness(300, 9, "reliable")).toBe("limited");
    expect(comparisonReadiness(300, 300, "early")).toBe("limited");
    expect(comparisonReadiness(300, 300, "developing")).toBe("limited");
    expect(comparisonReadiness(300, 300)).toBe("limited");
    expect(comparisonReadiness(300, 300, "unknown")).toBe("limited");
  });
  it("allows the existing verdict only with actual sample and confidence evidence", () => {
    expect(comparisonReadiness(10, 10, "reliable")).toBe("supported");
  });
});
