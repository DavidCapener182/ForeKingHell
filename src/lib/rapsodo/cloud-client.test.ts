import { describe, expect, it, vi } from "vitest";

import { RapsodoCloudClient, RapsodoCloudError } from "@/lib/rapsodo/cloud-client";

describe("RapsodoCloudClient", () => {
  it("logs in with email and password and returns the R-Cloud token", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input.toString()).toBe("https://rapsodo.test/auth/login");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        email: "player@example.com",
        password: "secret",
      });
      expect((init?.headers as Record<string, string>).os).toBe("web");

      return jsonResponse({ token: "mlm-token", data: { id: "user-1" } });
    });

    const result = await new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    }).login("player@example.com", "secret");

    expect(result).toEqual({
      token: "mlm-token",
      profile: { id: "user-1" },
    });
  });

  it("switches to the MLM2 token after login when the profile has a registered device", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();

      if (url.endsWith("/auth/login")) {
        return jsonResponse({
          token: "login-token",
          data: { id: "user-1", registeredSerial: "MLM2PRO" },
        });
      }

      expect(url).toBe("https://rapsodo.test/auth/token/switch/2");
      expect((init?.headers as Record<string, string>).authorization).toBe("login-token");

      return jsonResponse({ token: "mlm2-token" });
    });

    const result = await new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    }).login("player@example.com", "secret");

    expect(result.token).toBe("mlm2-token");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("throws an auth error when login is rejected", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ message: "Nope" }, 401));
    const client = new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(client.login("player@example.com", "bad")).rejects.toMatchObject({
      name: "RapsodoCloudError",
      status: 401,
      code: "RAPSODO_AUTH_EXPIRED",
      message: "Nope",
    } satisfies Partial<RapsodoCloudError>);
  });

  it("lists and normalizes practice and simulation sessions from observed endpoints", async () => {
    const seenUrls: string[] = [];
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      seenUrls.push(url);
      expect((init?.headers as Record<string, string>).authorization).toBe("mlm-token");

      if (url.includes("/session/user/list")) {
        return jsonResponse({
          data: {
            sessions: [
              {
                id: "practice-1",
                name: "Range work",
                type: "practice",
                startDate: "2026-05-01T10:00:00Z",
                shotCount: 12,
                count: 99,
              },
            ],
          },
        });
      }

      if (url.includes("gameType=1")) {
        return jsonResponse({
          simulations: [
            {
              simulationId: "sim-1",
              gameType: "range",
              createdAt: "2026-05-02T10:00:00Z",
              numberOfShots: "7",
            },
          ],
        });
      }

      if (url.includes("gameType=0%2C8%2C9")) {
        return jsonResponse({
          data: [
            {
              simulationid: "course-1",
              coursename: "Pebble Beach",
              startdate: "2026-05-03T10:00:00Z",
              shotcount: 9,
              count: 99,
            },
          ],
        });
      }

      return jsonResponse({ data: [] });
    });

    const sessions = await new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    }).listSessions("mlm-token", { take: 25, startDate: "2026-05-01", endDate: "2026-05-05" });

    expect(seenUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "/session/user/list?skip=0&take=25&startDate=2026-05-01&endDate=2026-05-05&type=0%2C+1%2C+2%2C+3",
        ),
        expect.stringContaining(
          "/session/user/list?skip=0&take=25&startDate=2026-05-01&endDate=2026-05-05&type=0%2C+3&sessionModes=7",
        ),
        expect.stringContaining(
          "/simulation/sessions?skip=0&take=25&minDate=2026-05-01&maxDate=2026-05-05&gameType=1",
        ),
        expect.stringContaining("gameType=0%2C8%2C9"),
      ]),
    );
    expect(sessions.map((session) => session.providerSessionId)).toEqual([
      "course-1",
      "sim-1",
      "practice-1",
    ]);
    expect(sessions[0]).toMatchObject({
      providerKind: "simulation",
      providerSessionMode: "courses",
      title: "Pebble Beach",
      shotCount: 9,
      courseName: "Pebble Beach",
    });
    expect(sessions[2]).toMatchObject({
      providerKind: "practice",
      providerSessionId: "practice-1",
      title: "Range work",
      shotCount: 12,
    });
  });

  it("deduplicates sessions by provider kind and provider session id", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();

      if (url.includes("gameType=1") || url.includes("gameType=2")) {
        return jsonResponse({
          data: [
            {
              id: "same-sim",
              name: "Duplicate sim",
              createdAt: "2026-05-02T10:00:00Z",
            },
          ],
        });
      }

      return jsonResponse({ data: [] });
    });

    const sessions = await new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    }).listSessions("mlm-token");

    expect(sessions).toHaveLength(1);
    expect(sessions[0].providerSessionId).toBe("same-sim");
  });

  it("surfaces expired token responses from any session-list endpoint", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) =>
      input.toString().includes("/session/user/list")
        ? jsonResponse({ message: "Token expired" }, 403)
        : jsonResponse({ data: [] }),
    );
    const client = new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(client.listSessions("expired-token")).rejects.toMatchObject({
      status: 403,
      code: "RAPSODO_AUTH_EXPIRED",
      message: "Token expired",
    });
  });

  it("throws instead of returning an empty list when every session endpoint fails", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ message: "Something went wrong" }, 400));
    const client = new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(client.listSessions("mlm-token")).rejects.toMatchObject({
      status: 400,
      code: "RAPSODO_REQUEST_FAILED",
      message: "Something went wrong",
    });
  });

  it("normalizes opaque R-Cloud error codes into fallback guidance", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(
        { message: "Something went wrong. Code: 8ca9a351-ac09-43f2-9dad-9ae6f16125e6" },
        500,
      ),
    );
    const client = new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(client.listSessions("mlm-token")).rejects.toMatchObject({
      status: 500,
      code: "RAPSODO_REQUEST_FAILED",
      message:
        "R-Cloud rejected that request. Try loading sessions again; if it keeps happening, export the CSV manually from R-Cloud and import it from /import.",
    });
  });

  it("exports practice and simulation CSV text from the correct detail endpoints", async () => {
    const seenUrls: string[] = [];
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      seenUrls.push(input.toString());
      return textResponse("Club Type,Carry Distance\nDriver,240");
    });
    const client = new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(
      client.exportSessionCsv("token", {
        providerKind: "practice",
        providerSessionId: "practice-1",
      }),
    ).resolves.toContain("Driver");
    await expect(
      client.exportSessionCsv("token", { providerKind: "simulation", providerSessionId: "sim-1" }),
    ).resolves.toContain("Driver");

    expect(seenUrls).toEqual([
      "https://rapsodo.test/session/practice-1/details/export",
      "https://rapsodo.test/simulation/sim-1/details/export",
    ]);
  });

  it("lists and normalizes Rapsodo bag clubs", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input.toString()).toBe("https://rapsodo.test/bag/v2/default");
      expect((init?.headers as Record<string, string>).authorization).toBe("mlm-token");

      return jsonResponse({
        data: {
          clubs: [
            {
              id: "club-1",
              clubCode: "Driver",
              brandName: "Titleist",
              modelName: "GT3",
            },
          ],
        },
      });
    });

    const clubs = await new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    }).listBagClubs("mlm-token");

    expect(clubs).toEqual([
      expect.objectContaining({
        rapsodoClubId: "club-1",
        clubType: "driver",
        clubLabel: "Driver",
        clubBrand: "Titleist",
        clubModel: "GT3",
        clubKey: "driver:titleist:gt3",
      }),
    ]);
  });

  it("lists shot refs from the detail endpoint", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input.toString()).toBe(
        "https://rapsodo.test/session/practice-1/details?skip=0&take=200",
      );
      expect((init?.headers as Record<string, string>).authorization).toBe("mlm-token");

      return jsonResponse({
        data: {
          shots: [
            { localId: "shot-a", shotNumber: 1 },
            { id: "shot-b", shotNo: "2" },
          ],
        },
      });
    });

    const refs = await new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    }).listSessionShotRefs(
      "mlm-token",
      { providerKind: "practice", providerSessionId: "practice-1" },
      200,
    );

    expect(refs).toEqual([
      expect.objectContaining({ rapsodoShotId: "shot-a", shotNumber: 1, sequenceIndex: 0 }),
      expect.objectContaining({ rapsodoShotId: "shot-b", shotNumber: 2, sequenceIndex: 1 }),
    ]);
  });

  it("updates shot clubs using practice and simulation write-back endpoints", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: input.toString(),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });

      return jsonResponse({ success: true });
    });
    const client = new RapsodoCloudClient({
      apiBaseUrl: "https://rapsodo.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(
      client.updateShotClubs("mlm-token", { providerKind: "practice" }, [
        { rapsodoShotId: "shot-a", rapsodoClubId: "club-1" },
        { rapsodoShotId: "shot-b", rapsodoClubId: "club-1" },
      ]),
    ).resolves.toBe(2);
    await expect(
      client.updateShotClubs("mlm-token", { providerKind: "simulation" }, [
        { rapsodoShotId: "shot-c", rapsodoClubId: "club-2" },
      ]),
    ).resolves.toBe(1);

    expect(requests).toEqual([
      {
        url: "https://rapsodo.test/shot/v2/change/club",
        body: { clubId: "club-1", shotIds: ["shot-a", "shot-b"] },
      },
      {
        url: "https://rapsodo.test/simulation/shot/club",
        body: { clubId: "club-2", shotIds: ["shot-c"] },
      },
    ]);
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(payload: string, status = 200) {
  return new Response(payload, {
    status,
    headers: { "content-type": "text/csv" },
  });
}
