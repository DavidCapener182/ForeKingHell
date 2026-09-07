import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), feed: vi.fn() }));
vi.mock("@/lib/current-user", () => ({ getOptionalCurrentUserId: mocks.user }));
vi.mock("@/lib/social", () => ({ getVisibleFeedItemsForViewer: mocks.feed }));
import { GET } from "./route";

const request = new Request("http://localhost/api/share-cards/feed/card");
const context = { params: Promise.resolve({ feedItemId: "card" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue("viewer");
  mocks.feed.mockResolvedValue([]);
});

describe("share-card download boundary", () => {
  it("rejects anonymous requests before loading feed data", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await GET(request, context)).status).toBe(401);
    expect(mocks.feed).not.toHaveBeenCalled();
  });
  it("does not export an item absent from the viewer's visible feed", async () => {
    expect((await GET(request, context)).status).toBe(404);
    expect(mocks.feed).toHaveBeenCalledWith("viewer", { limit: 80 });
  });
  it("escapes supplied text and returns a private SVG response", async () => {
    mocks.feed.mockResolvedValue([
      {
        id: "card",
        headline: '<script>alert("x")</script>',
        metricLabel: "carry",
        metricValue: "250 & 260",
        context: "<image onload='x'>",
        verificationLabel: "Imported",
        profile: { username: "a&b" },
      },
    ]);
    const response = await GET(request, context);
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(response.headers.get("cache-control")).toContain("private");
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("<image");
    expect(body).toContain("&lt;script&gt;");
    expect(body).toContain("250 &amp; 260");
    expect(body).toContain("@a&amp;b");
  });
});
