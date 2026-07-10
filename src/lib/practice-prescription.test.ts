import { describe, expect, it } from "vitest";

import { buildPracticePrescription } from "@/lib/practice-prescription";

describe("buildPracticePrescription", () => {
  it("turns a measured directional weakness into a reassessable session", () => {
    const plan = buildPracticePrescription({
      clubLabel: "Driver",
      weakness: "direction",
      evidence: "Median offline is 18 yards left across 24 trusted shots.",
      sampleSize: 24,
    });
    expect(plan.goal).toContain("Driver");
    expect(plan.evidence).toContain("24 trusted shots");
    expect(plan.successThreshold).toContain("final 10");
    expect(plan.stopCondition).toBeTruthy();
    expect(plan.metricsToReview).toContain("offline bias");
  });
});
