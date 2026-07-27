import { describe, expect, it } from "vitest";

import {
  buildCourseTwinAutomaticGreenCompletion,
  buildCourseTwinManualGreenCompletion,
  courseTwinAutomaticPuttCount,
  courseTwinDistanceToPinYd,
  courseTwinHoleScoreLabel,
  courseTwinRoundCreatesAnalyticsSession,
  courseTwinRoundScore,
  parseCourseTwinCreateRoundInput,
  parseCourseTwinRoundEventInput,
  reduceCourseTwinRoundEvents,
  stableCourseTwinRoundJson,
  type CourseTwinRoundLedgerEvent,
  type CourseTwinRoundSummary,
} from "@/lib/course-twin-round";

const eventId = "0de8b595-5b93-48c1-93dc-b2c872339766";
const shotEventId = "5b328b80-70cb-43fe-b588-cb8be627ab32";
const puttEventId = "31c9f166-d82a-43a8-8bd8-636e3477a37a";

describe("Course Twin round contract", () => {
  it("keeps My Bag test rounds out of the golfer's analytics history", () => {
    expect(courseTwinRoundCreatesAnalyticsSession("play")).toBe(false);
    expect(courseTwinRoundCreatesAnalyticsSession("live")).toBe(true);
  });

  it("auto-putts once at ten feet or less and twice from farther away", () => {
    expect(courseTwinAutomaticPuttCount(0)).toBe(1);
    expect(courseTwinAutomaticPuttCount(10 / 3)).toBe(1);
    expect(courseTwinAutomaticPuttCount(10.01 / 3)).toBe(2);
    expect(courseTwinAutomaticPuttCount(60 / 3)).toBe(2);
  });

  it("adds completed-hole scores and keeps the latest birdie visible", () => {
    const scorecard = [
      {
        holeNumber: 1,
        par: 4,
        yards: 390,
        strokes: 5,
        putts: 2,
        penalties: 0,
        fairwayHit: false,
        gir: false,
      },
      {
        holeNumber: 2,
        par: 4,
        yards: 370,
        strokes: 8,
        putts: 2,
        penalties: 2,
        fairwayHit: false,
        gir: false,
      },
      {
        holeNumber: 3,
        par: 5,
        yards: 470,
        strokes: 4,
        putts: 1,
        penalties: 0,
        fairwayHit: true,
        gir: true,
      },
    ];

    expect(courseTwinRoundScore(scorecard)).toEqual({
      strokes: 17,
      par: 13,
      relativeToPar: 4,
    });
    expect(courseTwinHoleScoreLabel(scorecard[2].strokes, scorecard[2].par)).toBe("Birdie");
  });

  it("measures automatic putt distance from the saved finish to the mapped pin", () => {
    expect(courseTwinDistanceToPinYd([0, 0, 0], [0, 0, 3.048])).toBeCloseTo(10 / 3, 5);
  });

  it("accepts honest casual and competition rule sets", () => {
    expect(
      parseCourseTwinCreateRoundInput({
        mode: "play",
        holeCount: 18,
        startingHole: 1,
        rules: {
          windSpeedMph: 12,
          windDirectionDeg: 225,
          greenRule: "automatic_putts",
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
        greenRule: "automatic_putts",
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

  it("bounds and normalises modelled putt events", () => {
    expect(
      parseCourseTwinRoundEventInput({
        type: "putt.accepted",
        clientEventId: puttEventId,
        payload: {
          holeNumber: 5,
          puttNumber: 2,
          source: "modelled",
          start: [2, 0.1, 4],
          end: [2.1, 0.09, 7.2],
          distanceM: 3.21,
          remainingDistanceM: 0,
          aimOffsetDeg: -1.5,
          pacePercent: 102,
          holed: true,
        },
      }),
    ).toMatchObject({
      type: "putt.accepted",
      payload: { puttNumber: 2, source: "modelled", holed: true },
    });
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
      acceptedPutts: [],
      mulliganCount: 1,
      scorecard: [{ holeNumber: 1, strokes: 5 }],
    });
  });

  it("reduces manual putts and completes a holed putting ledger honestly", () => {
    const summary = reduceCourseTwinRoundEvents({
      startingHole: 1,
      events: [
        ledger("shot.accepted", shotEventId, 1, {
          holeNumber: 1,
          shotNumber: 1,
          clubId: "64f25e50-89fa-4772-8b6a-5cb4b20859fd",
          clubType: "5w",
          source: "modelled",
          start: [0, 0, 0],
          carryEnd: [0, 0, 170],
          totalEnd: [0, 0, 187],
          metrics: {
            carryYd: 186,
            totalYd: 204,
            ballSpeedMph: 130,
            clubSpeedMph: null,
            launchAngleDeg: 15,
            launchDirectionDeg: 0,
            spinRate: 3_200,
            spinAxis: 0,
          },
          result: { finalSurface: "green", penalty: null, bounceCount: 2 },
        }),
        ledger("putt.accepted", puttEventId, 2, {
          holeNumber: 1,
          puttNumber: 1,
          source: "modelled",
          start: [0, 0, 187],
          end: [0, 0, 190],
          distanceM: 3,
          remainingDistanceM: 0,
          aimOffsetDeg: 0,
          pacePercent: 100,
          holed: true,
        }),
      ] as CourseTwinRoundLedgerEvent[],
    });

    expect(summary.acceptedPutts).toHaveLength(1);
    expect(
      buildCourseTwinManualGreenCompletion({
        summary,
        hole: { holeNumber: 1, par: 3, yards: 190 },
      }),
    ).toMatchObject({
      triggerPuttClientEventId: puttEventId,
      payload: { strokes: 2, putts: 1, gir: true },
    });
  });

  it("canonicalises object keys for a stable ledger hash input", () => {
    expect(stableCourseTwinRoundJson({ z: 1, a: { d: 2, b: 3 } })).toBe(
      '{"a":{"b":3,"d":2},"z":1}',
    );
  });

  it("automatically completes a saved green lie without requiring another full shot", () => {
    const summary = {
      status: "in_progress",
      currentHole: 1,
      scorecard: [],
      mulliganCount: 0,
      acceptedPutts: [],
      acceptedShots: [
        {
          holeNumber: 1,
          shotNumber: 1,
          clubId: "64f25e50-89fa-4772-8b6a-5cb4b20859fd",
          clubType: "5w",
          source: "modelled",
          start: [0, 0, 0],
          carryEnd: [0, 0, 170],
          totalEnd: [0, 0, 187],
          metrics: {
            carryYd: 186,
            totalYd: 204,
            ballSpeedMph: 130,
            clubSpeedMph: null,
            launchAngleDeg: 15,
            launchDirectionDeg: 0,
            spinRate: 3_200,
            spinAxis: 0,
          },
          result: { finalSurface: "green", penalty: null, bounceCount: 2 },
          clientEventId: shotEventId,
          eventId,
          sequence: 1,
        },
      ],
    } satisfies CourseTwinRoundSummary;

    expect(
      buildCourseTwinAutomaticGreenCompletion({
        summary,
        hole: {
          holeNumber: 1,
          par: 3,
          yards: 190,
          green: [0, 0, 190],
        },
      }),
    ).toMatchObject({
      triggerShotClientEventId: shotEventId,
      remainingYd: expect.closeTo(3.28, 1),
      payload: {
        holeNumber: 1,
        strokes: 2,
        putts: 1,
        penalties: 0,
        gir: true,
      },
    });
  });

  it("does not auto-complete an off-green lie or an already-scored hole", () => {
    const summary = {
      status: "in_progress",
      currentHole: 1,
      scorecard: [],
      mulliganCount: 0,
      acceptedPutts: [],
      acceptedShots: [
        {
          holeNumber: 1,
          shotNumber: 1,
          clubId: "64f25e50-89fa-4772-8b6a-5cb4b20859fd",
          clubType: "5w",
          source: "modelled",
          start: [0, 0, 0],
          carryEnd: [0, 0, 170],
          totalEnd: [0, 0, 187],
          metrics: {
            carryYd: 186,
            totalYd: 204,
            ballSpeedMph: 130,
            clubSpeedMph: null,
            launchAngleDeg: 15,
            launchDirectionDeg: 0,
            spinRate: 3_200,
            spinAxis: 0,
          },
          result: { finalSurface: "fairway", penalty: null, bounceCount: 2 },
          clientEventId: shotEventId,
          eventId,
          sequence: 1,
        },
      ],
    } satisfies CourseTwinRoundSummary;
    const hole = { holeNumber: 1, par: 3, yards: 190, green: [0, 0, 190] } as const;

    expect(buildCourseTwinAutomaticGreenCompletion({ summary, hole })).toBeNull();
    expect(
      buildCourseTwinAutomaticGreenCompletion({
        summary: {
          ...summary,
          scorecard: [
            {
              holeNumber: 1,
              par: 3,
              yards: 190,
              strokes: 3,
              putts: 2,
              penalties: 0,
              fairwayHit: null,
              gir: true,
            },
          ],
          acceptedShots: [
            {
              ...summary.acceptedShots[0],
              result: { finalSurface: "green", penalty: null, bounceCount: 2 },
            },
          ],
        },
        hole,
      }),
    ).toBeNull();
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
