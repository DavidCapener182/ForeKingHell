import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendCourseTwinRoundEventClient,
  createCourseTwinRoundClient,
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
});
