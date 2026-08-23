import { beforeEach, describe, expect, it, vi } from "vitest";

import { dataGovernanceManifest } from "@/lib/data-governance-manifest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getOptionalCurrentUserId: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/current-user", () => ({
  getOptionalCurrentUserId: mocks.getOptionalCurrentUserId,
}));

describe("personal data export route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getDb.mockReset();
    mocks.getOptionalCurrentUserId.mockReset();
  });

  it("rejects anonymous requests", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue(null);
    const { GET } = await import("@/app/api/settings/export/route");

    const response = await GET(new Request("http://localhost/api/settings/export"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("returns a private, no-store, versioned personal export", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue("user-1");
    mocks.getDb.mockReturnValue(emptyDb());
    const { GET } = await import("@/app/api/settings/export/route");

    const response = await GET(new Request("http://localhost/api/settings/export"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="forekinghell-personal-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(payload).toMatchObject({
      schemaVersion: "2026-07-21",
      scope: "personal",
      userId: "user-1",
      profile: null,
      pagination: {
        shots: {
          limit: 5000,
          cursor: null,
          nextCursor: null,
          hasMore: false,
          nextPath: null,
        },
      },
    });
    expect(payload.data.moderationEvents).toBeUndefined();
    expect(payload.data.leaderboardSnapshots).toBeUndefined();
    expect(Object.keys(payload.data).sort()).toEqual(
      dataGovernanceManifest
        .filter((entry) => entry.export && entry.dataset !== "users")
        .map((entry) => entry.dataset)
        .sort(),
    );
  });
});

function emptyDb() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => emptyRows()),
      })),
    })),
  };
}

function emptyRows() {
  return Object.assign(Promise.resolve([]), {
    orderBy: vi.fn(() => ({
      limit: vi.fn(async () => []),
    })),
  });
}
