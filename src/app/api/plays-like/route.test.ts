import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOptionalCurrentUserId: vi.fn(),
  getLivePlaysLikeSnapshotForCourse: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({
  getOptionalCurrentUserId: mocks.getOptionalCurrentUserId,
}));

vi.mock("@/lib/api-protection", () => ({
  rateLimitRequest: vi.fn(() => null),
}));

vi.mock("@/lib/plays-like-weather", () => ({
  getLivePlaysLikeSnapshotForCourse: mocks.getLivePlaysLikeSnapshotForCourse,
}));

describe("plays-like route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getOptionalCurrentUserId.mockReset();
    mocks.getLivePlaysLikeSnapshotForCourse.mockReset();
  });

  it("requires authentication", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue(null);
    const { GET } = await import("@/app/api/plays-like/route");

    const response = await GET(request("course-1"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ message: "Authentication required." });
  });

  it("requires a course id", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue("user-1");
    const { GET } = await import("@/app/api/plays-like/route");

    const response = await GET(request(""));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ message: "courseId is required." });
  });

  it("returns owner-scoped live snapshots with private cache headers", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue("user-1");
    mocks.getLivePlaysLikeSnapshotForCourse.mockResolvedValue({
      source: "live",
      provider: "open_meteo",
      courseId: "course-1",
      conditions: { temperatureC: 18 },
      fetchedAt: "2026-07-01T00:00:00.000Z",
      expiresAt: "2026-07-01T00:30:00.000Z",
    });
    const { GET } = await import("@/app/api/plays-like/route");

    const response = await GET(request("course-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    expect(mocks.getLivePlaysLikeSnapshotForCourse).toHaveBeenCalledWith({
      userId: "user-1",
      courseId: "course-1",
    });
    await expect(response.json()).resolves.toMatchObject({
      source: "live",
      provider: "open_meteo",
    });
  });

  it("reports provider failures without leaking internals", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue("user-1");
    mocks.getLivePlaysLikeSnapshotForCourse.mockRejectedValue(new Error("Weather unavailable"));
    const { GET } = await import("@/app/api/plays-like/route");

    const response = await GET(request("course-1"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ message: "Weather unavailable" });
  });
});

function request(courseId: string) {
  const url = new URL("http://test.local/api/plays-like");

  if (courseId) {
    url.searchParams.set("courseId", courseId);
  }

  return Object.assign(new Request(url), { nextUrl: url }) as never;
}
