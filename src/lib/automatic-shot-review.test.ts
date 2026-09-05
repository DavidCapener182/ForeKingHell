import { describe, it, expect } from "vitest";
import { createAutomaticShotReviewer, type ReviewEvidenceShot } from "./automatic-shot-review";
const shot = (patch: Partial<ReviewEvidenceShot> = {}): ReviewEvidenceShot => ({
  id: "candidate",
  sessionId: "current",
  clubId: "7i",
  clubType: "7i",
  playContext: "range",
  sessionSource: "rapsodo",
  carryYd: 150,
  totalYd: 160,
  ballSpeedMph: 105,
  clubSpeedMph: 75,
  smashFactor: 1.4,
  shotCategory: "full",
  qualityTag: null,
  reviewStatus: "included",
  reviewSource: null,
  ...patch,
});
const profile = (clubId: string, carry: number, speed: number, count = 24) =>
  Array.from({ length: count }, (_, index) =>
    shot({
      id: `${clubId}-${index}`,
      sessionId: `history-${index % 2}`,
      clubId,
      clubType: clubId,
      carryYd: carry + ((index % 5) - 2),
      totalYd: carry + 10,
      ballSpeedMph: speed + ((index % 3) - 1),
      clubSpeedMph: null,
      smashFactor: null,
    }),
  );
const history = [...profile("7i", 150, 105), ...profile("driver", 220, 150)];
const mislabeled = shot({
  carryYd: 220,
  totalYd: 230,
  ballSpeedMph: 150,
  clubSpeedMph: 105,
  smashFactor: null,
});
describe("conservative automatic shot review", () => {
  it("suggests a unique independently established club using carry AND speed", () =>
    expect(createAutomaticShotReviewer(history)(mislabeled)).toMatchObject({
      classification: "Possible wrong club",
      suggestedClubId: "driver",
      confidence: "Moderate",
    }));
  it("does not treat distance alone as club identity", () =>
    expect(
      createAutomaticShotReviewer(history)(
        shot({ ...mislabeled, ballSpeedMph: 106, clubSpeedMph: null }),
      ),
    ).not.toMatchObject({ classification: "Possible wrong club" }));
  it("requires 20 paired samples and two other sessions", () => {
    expect(
      createAutomaticShotReviewer([...profile("7i", 150, 105), ...profile("driver", 220, 150, 19)])(
        mislabeled,
      ),
    ).toBeNull();
    expect(
      createAutomaticShotReviewer(history.map((row) => ({ ...row, sessionId: "one" })))(mislabeled),
    ).toBeNull();
  });
  it("does not mix contexts, sources or the candidate session", () => {
    for (const field of ["playContext", "sessionSource", "sessionId"] as const) {
      expect(
        createAutomaticShotReviewer(
          history.map((row) => ({ ...row, [field]: field === "sessionId" ? "current" : "other" })),
        )(mislabeled),
      ).toBeNull();
    }
  });
  it("does not choose between two plausible clubs", () =>
    expect(
      createAutomaticShotReviewer([...history, ...profile("3w", 220, 150)])(mislabeled),
    ).toBeNull());
  it("preserves reviewed and excluded decisions", () => {
    for (const patch of [
      { reviewSource: "user" },
      { reviewStatus: "user_excluded" as const },
      { reviewStatus: "restored" as const },
    ])
      expect(createAutomaticShotReviewer(history)(shot({ ...mislabeled, ...patch }))).toBeNull();
  });
  it("classifies sensor anomalies before comparing clubs", () =>
    expect(
      createAutomaticShotReviewer(history)(shot({ ...mislabeled, totalYd: 100 })),
    ).toMatchObject({ classification: "Sensor anomaly" }));
  it("does not mistake a partial shot for a wrong club", () =>
    expect(
      createAutomaticShotReviewer(history)(
        shot({ clubId: "sw", clubType: "sw", shotCategory: "pitch", carryYd: 30, totalYd: 35 }),
      ),
    ).toMatchObject({ classification: "Partial swing" }));
  it("leaves ordinary trusted shots alone and never mutates inputs", () => {
    const before = JSON.stringify(history);
    expect(createAutomaticShotReviewer(history)(shot())).toBeNull();
    expect(JSON.stringify(history)).toBe(before);
  });
});
