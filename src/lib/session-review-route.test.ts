import { describe, expect, it } from "vitest";

import { companionReviewRoute } from "@/lib/session-review-route";

describe("companionReviewRoute", () => {
  it.each(["round", "real_round", "simulator", "simulated_course"])(
    "routes %s evidence to the round companion",
    (type) => {
      expect(companionReviewRoute({ id: "round-id", type })).toBe("/rounds/round-id");
    },
  );

  it.each(["range", "practice", "target", null])(
    "routes %s evidence to the practice companion",
    (type) => {
      expect(companionReviewRoute({ id: "session-id", type })).toBe("/sessions/session-id");
    },
  );
});
