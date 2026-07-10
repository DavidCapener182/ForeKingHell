import { describe, expect, it, beforeEach, vi } from "vitest";

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

vi.mock("@/lib/api-protection", () => ({
  readBoundedJsonBody: vi.fn(async (request: Request) => ({
    ok: true,
    value: await request.json().catch(() => null),
  })),
  rateLimitRequest: vi.fn(() => null),
}));

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse extends Response {
    constructor(_element: unknown, options: { headers?: HeadersInit }) {
      super("mock-image", { headers: options.headers });
    }
  },
}));

describe("content export routes", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getDb.mockReset();
    mocks.getOptionalCurrentUserId.mockReset();
  });

  it("rejects missing feed item sources", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue("user-1");
    const { POST } = await import("@/app/api/content-exports/route");

    const response = await POST(jsonRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ message: "Source item is required." });
  });

  it("does not export feed items the current user does not own", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue("user-1");
    mocks.getDb.mockReturnValue(dbWithFeedItemRows([]));
    const { POST } = await import("@/app/api/content-exports/route");

    const response = await POST(jsonRequest({ sourceId: "feed-2" }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ message: "Source not found." });
  });

  it("creates owner feed item exports", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue("user-1");
    mocks.getDb.mockReturnValue(
      dbWithFeedItemRows([
        {
          id: "feed-1",
          userId: "user-1",
          headline: "New driver PB",
          metricLabel: "Carry",
          metricValue: "286 yd",
          context: "Previous best: 274 yd",
          verificationLabel: "Verified import",
          profileUsername: "forekinghell",
        },
      ]),
    );
    const { POST } = await import("@/app/api/content-exports/route");

    const response = await POST(jsonRequest({ sourceId: "feed-1" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      exportId: "export-1",
      imageUrl: "/api/content-exports/export-1/image",
    });
  });

  it("renders private 9:16 image responses", async () => {
    mocks.getOptionalCurrentUserId.mockResolvedValue("user-1");
    mocks.getDb.mockReturnValue(
      dbWithExportRows([
        {
          id: "export-1",
          snapshotJson: {
            title: "New driver PB",
            metricLabel: "Carry",
            metricValue: "286 yd",
            context: "Previous best: 274 yd",
            footer: "Verified import / @forekinghell",
            username: "forekinghell",
            generatedAt: "2026-06-30T09:00:00.000Z",
          },
        },
      ]),
    );
    const { GET } = await import("@/app/api/content-exports/[exportId]/image/route");

    const response = await GET(
      new Request("http://test.local/api/content-exports/export-1/image"),
      {
        params: Promise.resolve({ exportId: "export-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
  });
});

function jsonRequest(body: Record<string, unknown>) {
  return new Request("http://test.local/api/content-exports", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  }) as never;
}

function dbWithFeedItemRows(rows: unknown[]) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => rows),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: "export-1" }]),
      })),
    })),
  };
}

function dbWithExportRows(rows: unknown[]) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => rows),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
  };
}
