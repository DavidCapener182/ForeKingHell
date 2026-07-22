import { describe, expect, it } from "vitest";

import {
  parseCourseTwinCreateRoundInput,
  parseCourseTwinRoundEventInput,
  reduceCourseTwinRoundEvents,
  stableCourseTwinRoundJson,
  type CourseTwinRoundLedgerEvent,
} from "@/lib/course-twin-round";

const eventId = "0de8b595-5b93-48c1-93dc-b2c872339766";
const shotEventId = "5b328b80-70cb-43fe-b588-cb8be627ab32";

describe("Course Twin round contract", () => {
  it("accepts honest casual and competition rule sets", () => {
    expect(
      parseCourseTwinCreateRoundInput({
        mode: "play",
        holeCount: 18,
        startingHole: 1,
        rules: {
          windSpeedMph: 12,
          windDirectionDeg: 225,
          greenRule: "manual_putts",
          mulligansAllowed: true,
          competition: false,
        },
      }),
    ).toMatchObject({ mode: "play", holeCount: 18 });
    expect(
      parseCourseTwinCreateRoundInput({
        mode: "live",
        holeCount: 9,
        startingHole: 10,
        rules: {
          windSpeedMph: 8,
          windDirectionDeg: 180,
          greenRule: "competition_gimmes",
          mulligansAllowed: false,
          competition: true,
        },
      }),
    ).toMatchObject({ mode: "live", startingHole: 10 });
  });

  it("rejects competition mulligans, impossible winds and over-running nines", () => {
    const base = {
      mode: "play",
      holeCount: 9,
      startingHole: 1,
      rules: {
        windSpeedMph: 0,
        windDirectionDeg: 0,
        greenRule: "manual_putts",
        mulligansAllowed: false,
        competition: false,
      },
    };
    expect(
      parseCourseTwinCreateRoundInput({
        ...base,
        rules: { ...base.rules, competition: true, mulligansAllowed: true },
      }),
    ).toBeNull();
    expect(
      parseCourseTwinCreateRoundInput({
        ...base,
        rules: { ...base.rules, windSpeedMph: 90 },
      }),
    ).toBeNull();
    expect(parseCourseTwinCreateRoundInput({ ...base, startingHole: 11 })).toBeNull();
  });

  it("bounds and normalises measured shot events", () => {
    expect(
      parseCourseTwinRoundEventInput({
        type: "shot.accepted",
        clientEventId: shotEventId,
        payload: {
          holeNumber: 5,
          shotNumber: 1,
          clubId: "64f25e50-89fa-4772-8b6a-5cb4b20859fd",
          clubType: "driver",
          source: "measured",
          start: [0, 0, 0],
          carryEnd: [4, 0, 185],
          totalEnd: [5, 0, 201],
          metrics: {
            carryYd: 202,
            totalYd: 220,
            ballSpeedMph: 143.2,
            clubSpeedMph: null,
            launchAngleDeg: 13.4,
            launchDirectionDeg: 1.2,
            spinRate: 2675,
            spinAxis: -3.5,
          },
          result: { finalSurface: "fairway", penalty: null, bounceCount: 3 },
        },
      }),
    ).toMatchObject({ type: "shot.accepted", payload: { source: "measured" } });
  });

  it("reduces mulligans and scorecard events deterministically", () => {
    const events = [
      ledger("shot.accepted", shotEventId, 1, {
        holeNumber: 1,
        shotNumber: 1,
        clubId: "64f25e50-89fa-4772-8b6a-5cb4b20859fd",
        clubType: "driver",
        source: "modelled",
        start: [0, 0, 0],
        carryEnd: [0, 0, 180],
        totalEnd: [0, 0, 195],
        metrics: {
          carryYd: 197,
          totalYd: 213,
          ballSpeedMph: 140,
          clubSpeedMph: null,
          launchAngleDeg: 14,
          launchDirectionDeg: 0,
          spinRate: 2500,
          spinAxis: 0,
        },
        result: { finalSurface: "fairway", penalty: null, bounceCount: 2 },
      }),
      ledger("shot.mulligan", eventId, 2, { shotClientEventId: shotEventId, reason: null }),
      ledger("hole.completed", "e291bb85-03fd-4149-b243-eb54bfb6b351", 3, {
        holeNumber: 1,
        par: 4,
        yards: 390,
        strokes: 5,
        putts: 2,
        penalties: 0,
        fairwayHit: false,
        gir: false,
      }),
    ] as CourseTwinRoundLedgerEvent[];
    expect(reduceCourseTwinRoundEvents({ events, startingHole: 1 })).toMatchObject({
      status: "in_progress",
      currentHole: 2,
      acceptedShots: [],
      mulliganCount: 1,
      scorecard: [{ holeNumber: 1, strokes: 5 }],
    });
  });

  it("canonicalises object keys for a stable ledger hash input", () => {
    expect(stableCourseTwinRoundJson({ z: 1, a: { d: 2, b: 3 } })).toBe(
      '{"a":{"b":3,"d":2},"z":1}',
    );
  });
});

function ledger(
  type: CourseTwinRoundLedgerEvent["type"],
  clientEventId: string,
  sequence: number,
  payload: unknown,
) {
  return {
    id: `${sequence}de8b595-5b93-48c1-93dc-b2c87233976${sequence}`,
    type,
    clientEventId,
    payload,
    sequence,
    previousHash: sequence === 1 ? null : "a".repeat(64),
    eventHash: "b".repeat(64),
    createdAt: new Date("2026-07-22T12:00:00Z"),
  };
}
