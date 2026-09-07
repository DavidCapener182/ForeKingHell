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

  it("returns exactly one shot page and a continuation pointing after its last row", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue("user-1");
    const rows = Array.from({ length: 5001 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      userId: "user-1",
      carryYd: 100,
    }));
    mocks.getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () =>
            Object.assign(Promise.resolve([]), {
              orderBy: () => ({ limit: async () => rows }),
            }),
        }),
      }),
    });
    const { GET } = await import("@/app/api/settings/export/route");
    const response = await GET(new Request("http://localhost/api/settings/export"));
    const payload = await response.json();
    expect(payload.data.shots).toHaveLength(5000);
    expect(payload.data.shots.at(-1).id).toBe(rows[4999].id);
    expect(payload.pagination.shots).toMatchObject({
      hasMore: true,
      nextCursor: rows[4999].id,
      nextPath: `/api/settings/export?shotCursor=${rows[4999].id}`,
    });
    expect(payload.data.shots.some((row: { id: string }) => row.id === rows[5000].id)).toBe(false);
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
