import { describe, expect, it } from "vitest";

import {
  interactionNeedsAction,
  parseCoachInteractionType,
  visibilityForInteraction,
} from "./coach-workspace";

describe("coach workspace rules", () => {
  it("accepts only persisted interaction types", () => {
    expect(parseCoachInteractionType("practice_assignment")).toBe("practice_assignment");
    expect(parseCoachInteractionType("account_membership")).toBeNull();
  });

  it("keeps private notes coach-only and all feedback player-visible", () => {
    expect(visibilityForInteraction("private_note")).toBe("coach_only");
    expect(visibilityForInteraction("session_comment")).toBe("player_visible");
  });

  it("identifies open work without treating notes as assignments", () => {
    expect(interactionNeedsAction("evidence_request", "open")).toBe(true);
    expect(interactionNeedsAction("player_note", "open")).toBe(false);
    expect(interactionNeedsAction("practice_assignment", "completed")).toBe(false);
  });
});
