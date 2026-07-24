import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendCourseTwinRoundEventClient,
  CourseTwinRoundRequestError,
  courseTwinRoundHoleResumeState,
  courseTwinRoundPhysicalHoleNumber,
  createCourseTwinRoundClient,
  loadCourseTwinRoundClient,
  type CourseTwinRoundClientDocument,
} from "@/lib/course-twin-round-client";

afterEach(() => vi.unstubAllGlobals());

describe("Course Twin round browser client", () => {
  it("creates private rounds without caching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "round-1", version: 1 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await createCourseTwinRoundClient("course-1", {
      mode: "play",
      holeCount: 18,
      startingHole: 1,
      rules: {
        windSpeedMph: 0,
        windDirectionDeg: 0,
        greenRule: "manual_putts",
        mulligansAllowed: true,
        competition: false,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/course-twins/course-1/rounds",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
  });

  it("sends the optimistic version with every event", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "round-1", version: 3 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await appendCourseTwinRoundEventClient(
      { id: "round-1", version: 2 },
      {
        type: "round.abandoned",
        clientEventId: "e291bb85-03fd-4149-b243-eb54bfb6b351",
        payload: { reason: "test" },
      },
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ expectedVersion: 2 });
  });

  it("preserves conflict status and can refresh the canonical round", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Round version conflict." }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "round-1", version: 4 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      appendCourseTwinRoundEventClient(
        { id: "round-1", version: 2 },
        {
          type: "round.abandoned",
          clientEventId: "e291bb85-03fd-4149-b243-eb54bfb6b351",
          payload: { reason: "test" },
        },
      ),
    ).rejects.toMatchObject({
      name: "CourseTwinRoundRequestError",
      status: 409,
    } satisfies Partial<CourseTwinRoundRequestError>);
    await loadCourseTwinRoundClient("round-1");

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/course-twins/rounds/round-1",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("restores only the canonical current hole after returning to Play", () => {
    const round = roundDocument({
      currentHole: 10,
      acceptedShots: [
        shotEvent({ clientEventId: "hole-1-shot", holeNumber: 1, shotNumber: 1 }),
        shotEvent({
          clientEventId: "hole-10-shot-2",
          holeNumber: 10,
          shotNumber: 2,
          totalEnd: [104, 2, 208],
        }),
        shotEvent({
          clientEventId: "hole-10-shot-1",
          holeNumber: 10,
          shotNumber: 1,
          penalty: "water",
          carryEnd: [90, 1, 190],
        }),
      ],
      acceptedPutts: [
        {
          clientEventId: "hole-10-putt-1",
          holeNumber: 10,
          puttNumber: 1,
          source: "modelled",
          start: [104, 2, 208],
          end: [105, 2, 209],
          distanceM: 2,
          remainingDistanceM: 0.4,
          aimOffsetDeg: 0,
          pacePercent: 100,
          holed: false,
        },
      ],
    });

    expect(
      courseTwinRoundHoleResumeState(round, [
        { holeNumber: 1, tee: [0, 0, 0] },
        { holeNumber: 10, tee: [80, 1, 180] },
      ]),
    ).toEqual({
      holeNumber: 10,
      physicalHoleNumber: 10,
      start: [105, 2, 209],
      shotNumber: 3,
      puttNumber: 2,
      strokes: 4,
      penaltyStrokes: 1,
    });
  });

  it("maps the second circuit of an 18-hole round onto a nine-hole package", () => {
    const round = roundDocument({ currentHole: 10 });
    const holes = Array.from({ length: 9 }, (_, index) => ({
      holeNumber: index + 1,
      tee: [index * 10, 0, index * 20] as [number, number, number],
    }));

    expect(courseTwinRoundPhysicalHoleNumber(round, holes)).toBe(1);
    expect(courseTwinRoundHoleResumeState(round, holes)).toMatchObject({
      holeNumber: 10,
      physicalHoleNumber: 1,
      start: [0, 0, 0],
      shotNumber: 1,
    });
  });

  it("fails closed when the ledger current hole is absent from the package", () => {
    expect(
      courseTwinRoundHoleResumeState(roundDocument({ currentHole: 10, holeCount: 9 }), [
        { holeNumber: 1, tee: [0, 0, 0] },
      ]),
    ).toBeNull();
  });
});

function roundDocument({
  currentHole,
  holeCount = 18,
  acceptedShots = [],
  acceptedPutts = [],
}: {
  currentHole: number;
  holeCount?: 9 | 18;
  acceptedShots?: CourseTwinRoundClientDocument["summary"]["acceptedShots"];
  acceptedPutts?: CourseTwinRoundClientDocument["summary"]["acceptedPutts"];
}): CourseTwinRoundClientDocument {
  return {
    id: "round-1",
    courseId: "course-1",
    sessionId: null,
    mode: "play",
    status: "in_progress",
    holeCount,
    startingHole: 1,
    currentHole,
    version: 42,
    rulesJson: {
      windSpeedMph: 0,
      windDirectionDeg: 0,
      greenRule: "automatic_putts",
      mulligansAllowed: true,
      competition: false,
    },
    finalEventHash: null,
    summary: {
      status: "in_progress",
      currentHole,
      scorecard: [],
      acceptedShots,
      acceptedPutts,
      mulliganCount: 0,
    },
  };
}

function shotEvent({
  clientEventId,
  holeNumber,
  shotNumber,
  carryEnd = [100, 2, 200],
  totalEnd = [102, 2, 204],
  penalty = null,
}: {
  clientEventId: string;
  holeNumber: number;
  shotNumber: number;
  carryEnd?: [number, number, number];
  totalEnd?: [number, number, number];
  penalty?: "water" | "out_of_bounds" | null;
}): CourseTwinRoundClientDocument["summary"]["acceptedShots"][number] {
  return {
    clientEventId,
    holeNumber,
    shotNumber,
    clubId: "7i",
    clubType: "7i",
    source: "modelled",
    start: [0, 0, 0],
    carryEnd,
    totalEnd,
    metrics: {
      carryYd: 140,
      totalYd: 148,
      ballSpeedMph: 100,
      clubSpeedMph: null,
      launchAngleDeg: 20,
      launchDirectionDeg: 0,
      spinRate: 5_000,
      spinAxis: 0,
    },
    result: {
      finalSurface: penalty ? "water" : "fairway",
      penalty,
      bounceCount: 2,
    },
  };
}
