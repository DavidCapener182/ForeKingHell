import { describe, expect, it } from "vitest";
import {
  mobileClubEvidence,
  mobileClubNeighbours,
  type ClubEvidenceShot,
} from "./mobile-club-evidence";

const sample = (): ClubEvidenceShot[] =>
  Array.from({ length: 12 }, (_, i) => ({
    carryYd: 150 + (i % 3),
    totalYd: 160 + (i % 3),
    sideCarryYd: 5,
    ballSpeedMph: 110,
    launchAngleDeg: 17,
    shotAt: new Date(Date.UTC(2026, 0, 12 - i)),
    reviewStatus: "included",
    sessionType: "range",
    sessionId: i < 6 ? "new" : "old",
    sessionTitle: i < 6 ? "Latest session" : "Previous session",
  }));

describe("mobile club evidence", () => {
  it("keeps exclusions out of carry, supporting metrics, latest date and recent links", () => {
    const shots = sample();
    const e = mobileClubEvidence(
      [
        {
          ...shots[0],
          reviewStatus: "user_excluded",
          shotAt: "2026-02-01",
          carryYd: 300,
          totalYd: 330,
          sideCarryYd: 150,
          sessionId: "excluded",
        },
        ...shots,
      ],
      "7i",
      false,
    );
    expect(e.carry).toBe(151);
    expect(e.total).toBe(161);
    expect(e.side).toBe(5);
    expect(e.sampleSize).toBe(12);
    expect(e.verifiedAt).toBe("2026-01-12T00:00:00.000Z");
    expect(e.sessions.map((s) => s.id)).toEqual(["new", "old"]);
  });
  it("never calls missing lateral or speed evidence straight or zero", () => {
    const e = mobileClubEvidence(
      sample().map((s) => ({ ...s, sideCarryYd: null, ballSpeedMph: null, launchAngleDeg: null })),
      "7i",
      false,
    );
    expect(e.side).toBeNull();
    expect(e.sideLow).toBeNull();
    expect(e.ballSpeed).toBeNull();
    expect(e.launch).toBeNull();
    expect(e.sideSampleSize).toBe(0);
  });
  it("preserves insufficient-sample carry and excludes full swings from touch provenance", () => {
    expect(mobileClubEvidence(sample().slice(0, 2), "7i", false).carry).toBeNull();
    const e = mobileClubEvidence(
      [
        {
          carryYd: 20,
          totalYd: 24,
          sideCarryYd: 2,
          shotCategory: "chip",
          shotAt: "2026-01-01",
          reviewStatus: "included",
          sessionId: "touch",
        },
        {
          carryYd: 100,
          totalYd: 110,
          sideCarryYd: 10,
          shotCategory: "full",
          shotAt: "2026-02-01",
          reviewStatus: "included",
          sessionId: "full",
        },
      ],
      "sw",
      true,
    );
    expect(e.carry).toBe(20);
    expect(e.sampleSize).toBe(1);
    expect(e.verifiedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(e.sessions.map((s) => s.id)).toEqual(["touch"]);
  });
  it("selects the nearest trusted longer and shorter clubs without comparing like club types", () => {
    const clubs = [
      { id: "same", type: "7i", carry: 152 },
      { id: "long", type: "6i", carry: 160 },
      { id: "far", type: "driver", carry: 220 },
      { id: "short", type: "8i", carry: 140 },
      { id: "unknown", type: "9i", carry: null },
    ];
    expect(
      mobileClubNeighbours(clubs, { id: "current", type: "7i", carry: 150 }).map((c) => [
        c.id,
        c.gap,
      ]),
    ).toEqual([
      ["long", 10],
      ["short", -10],
    ]);
    expect(mobileClubNeighbours(clubs, { id: "current", type: "7i", carry: null })).toEqual([]);
    expect(clubs[0].id).toBe("same");
  });
});
