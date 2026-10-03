import { describe, expect, it, vi } from "vitest";
import { RapsodoCloudClient } from "./cloud-client";
import { parseRapsodoCsv } from "./parser";

const detail = {
  data: {
    session: { id: "session-1" },
    shots: [
      {
        id: "later",
        startDate: "2026-10-03T10:01:00Z",
        clubId: 7,
        carry: 91.44,
        carryTotal: 100.584,
        ballSpeed: 44.704,
        clubSpeed: 35.7632,
        apex: 3.048,
        sideCarry: 0,
        spinRate: 5000,
      },
      {
        id: "earlier",
        startDate: "2026-10-03T10:00:00Z",
        clubId: 7,
        carry: 0,
        ballSpeed: null,
        sideCarry: -0.9144,
      },
    ],
  },
};
const clubs = {
  clubs: [{ id: 7, code: "7i", type: "7i", brandName: "Test", modelName: 'Model "A"' }],
};

function client() {
  const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input.toString());
    expect(url.origin).toBe("https://beta.mlm.rapsodo.com");
    if (url.pathname === "/auth/login")
      return Response.json({ token: "beta-token", data: { registeredSerial: "MLM2PRO" } });
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer beta-token");
    if (url.pathname === "/session/v2/activities")
      return Response.json({
        data: [
          {
            id: "speed-1",
            sessionType: "DRY_SWING",
            startDate: "2026-10-03T12:00:00Z",
            shotCount: 3,
          },
          {
            id: "session-1",
            sessionType: "PRACTICE",
            startDate: "2026-10-03T10:00:00Z",
            shotCount: 2,
          },
          {
            id: "course-1",
            sessionType: "COURSE",
            startDate: "2026-10-02T10:00:00Z",
            shotCount: 50,
            courseName: "Bootle",
          },
        ],
      });
    if (url.pathname === "/session/v2/activities/session-1") return Response.json(detail);
    if (url.pathname === "/club/v2") return Response.json(clubs);
    throw new Error(`Unexpected beta endpoint: ${url.pathname}`);
  });
  return { api: new RapsodoCloudClient({ beta: true, fetchFn: fetchFn as typeof fetch }), fetchFn };
}

describe("beta R-Cloud workflow", () => {
  it("accepts live beta labels and date fields while preserving prefixed tokens", async () => {
    const fetchFn = vi.fn(async (_input: unknown, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe("JWT existing-token");
      return Response.json({
        data: [
          {
            id: "older",
            sessionType: "TARGET RANGE",
            date: "2026-10-03T13:41:49.269Z",
            shotCount: 7,
          },
          {
            id: "newer",
            sessionType: "TARGET RANGE",
            date: "2026-10-03T14:18:42.446Z",
            shotCount: 42,
          },
          { id: "middle", sessionType: "RANGE", date: "2026-10-03T13:58:14.313Z", shotCount: 44 },
        ],
      });
    });
    const api = new RapsodoCloudClient({ beta: true, fetchFn: fetchFn as typeof fetch });
    const sessions = await api.listSessions("JWT existing-token");
    expect(sessions.map((session) => session.providerSessionId)).toEqual([
      "newer",
      "middle",
      "older",
    ]);
    expect(sessions[0]).toMatchObject({
      providerKind: "simulation",
      providerSessionMode: "target",
      dateIso: "2026-10-03T14:18:42.446Z",
      shotCount: 42,
    });
    expect(sessions[2]).toMatchObject({
      providerKind: "simulation",
      providerSessionMode: "target",
    });
  });

  it("uses the beta API for login without the legacy token switch", async () => {
    const { api, fetchFn } = client();
    expect((await api.login("player@example.test", "synthetic")).token).toBe("beta-token");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it("keeps course identity, separates speed sessions and applies the requested limit after filtering", async () => {
    const { api, fetchFn } = client();
    const sessions = await api.listSessions("beta-token", { take: 1, startDate: "2026-10-01" });
    expect(sessions.map((session) => session.providerSessionId)).toEqual(["session-1"]);
    expect(fetchFn.mock.calls[0][0].toString()).toContain("startDate=2026-10-01");
    expect((await api.listSessions("beta-token"))[1]).toMatchObject({
      providerKind: "simulation",
      providerSessionMode: "courses",
      courseName: "Bootle",
    });
    expect((await api.listSpeedSessions("beta-token", { take: 1 }))[0]).toMatchObject({
      providerSessionId: "speed-1",
      swingCount: 3,
    });
  });
  it("converts SI shots into the existing parser without losing missing values, zero or source evidence", async () => {
    const { api } = client();
    const session = { providerKind: "practice" as const, providerSessionId: "session-1" };
    const csv = await api.exportSessionCsv("beta-token", session);
    const parsed = parseRapsodoCsv(csv);
    expect(parsed.shots).toHaveLength(2);
    expect(parsed.shots[0]).toMatchObject({
      shotNumber: 1,
      carryYd: 0,
      ballSpeedMph: null,
      sideCarryYd: -1,
    });
    expect(parsed.shots[1]).toMatchObject({
      shotNumber: 2,
      clubType: "7i",
      clubBrand: "Test",
      clubModel: 'Model "A"',
      sideCarryYd: 0,
      spinRate: 5000,
    });
    expect(parsed.shots[1].carryYd).toBeCloseTo(100);
    expect(parsed.shots[1].totalYd).toBeCloseTo(110);
    expect(parsed.shots[1].ballSpeedMph).toBeCloseTo(100);
    expect(parsed.shots[1].clubSpeedMph).toBeCloseTo(80);
    expect(parsed.shots[1].apexFt).toBeCloseTo(10);
    expect(csv).toContain("Beta source shot JSON");
    expect(
      (await api.listSessionShotRefs("beta-token", session)).map((shot) => shot.rapsodoShotId),
    ).toEqual(["earlier", "later"]);
  });
  it("rejects malformed lists instead of reporting an empty inbox", async () => {
    const api = new RapsodoCloudClient({
      beta: true,
      fetchFn: vi.fn(async () => Response.json({ error: "unexpected" })),
    });
    await expect(api.listSessions("token")).rejects.toThrow("unexpected session list");
  });
});
