import { describe, expect, it } from "vitest";
import { practiceActivityPresentation } from "./practice-planner-view";

const saved = {
  savedPlanId: "plan-1",
  status: "planned",
  started: false,
  paused: false,
  finished: false,
  hasMeasuredResult: false,
};

describe("practice activity presentation", () => {
  it("does not offer Resume merely because a plan is saved", () => {
    expect(practiceActivityPresentation(saved)).toMatchObject({
      label: "Your saved practice",
      action: "Start saved practice",
    });
    expect(practiceActivityPresentation({ ...saved, savedPlanId: null })).toMatchObject({
      label: "Recommended for you",
      action: "Start practice",
    });
  });
  it("restores the activity label from local progress even before the server start syncs", () => {
    expect(practiceActivityPresentation({ ...saved, started: true, paused: true })).toMatchObject({
      label: "Practice paused",
      action: "Resume Range Mode",
    });
    expect(practiceActivityPresentation({ ...saved, status: "awaiting_import" })).toMatchObject({
      label: "Practice in progress",
      action: "Resume Range Mode",
    });
  });
  it("never presents a completed physical activity as measured success", () => {
    for (const state of [
      { ...saved, finished: true },
      { ...saved, status: "completed" },
    ]) {
      expect(practiceActivityPresentation(state)).toMatchObject({
        label: "Practice activity complete",
        action: "Build next practice",
      });
      expect(practiceActivityPresentation(state).detail).toContain("Import matching shots");
    }
  });
  it("only calls a result measured when a measured result is available", () => {
    expect(
      practiceActivityPresentation({
        ...saved,
        status: "analysed",
        finished: true,
        hasMeasuredResult: true,
      }).label,
    ).toBe("Measured practice result");
    expect(practiceActivityPresentation({ ...saved, status: "analysed" }).label).not.toBe(
      "Measured practice result",
    );
  });
});
