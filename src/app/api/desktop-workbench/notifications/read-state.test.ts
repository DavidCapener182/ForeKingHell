import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), mark: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/notification-read-state", () => ({
  markNotificationsRead: mocks.mark,
  readNotificationState: vi.fn(),
}));
vi.mock("@/lib/server-observability", () => ({ reportServerFailure: mocks.report }));
import { POST } from "./route";

function request(body: unknown, origin = "https://fixture.test") {
  return new Request("https://fixture.test/api/desktop-workbench/notifications", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("notification read writes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "fixture-owner" });
    mocks.mark.mockResolvedValue(["friend-fixture"]);
  });
  it("binds writes to the authenticated account, ignoring a supplied owner", async () => {
    const result = await POST(request({ ids: ["friend-fixture"], userId: "other-account" }));
    expect(result.status).toBe(200);
    expect(mocks.mark).toHaveBeenCalledExactlyOnceWith("fixture-owner", ["friend-fixture"]);
    expect(await result.json()).toEqual({ readIds: ["friend-fixture"] });
  });
  it("rejects foreign origin and unauthenticated writes", async () => {
    expect((await POST(request({ ids: ["a"] }, "https://foreign.test"))).status).toBe(403);
    mocks.user.mockResolvedValue(null);
    expect((await POST(request({ ids: ["a"] }))).status).toBe(401);
    expect(mocks.mark).not.toHaveBeenCalled();
  });
  it("rejects invalid or unbounded writes without a mutation", async () => {
    for (const ids of [null, [5], [""], Array(81).fill("a"), ["a".repeat(121)]])
      expect((await POST(request({ ids }))).status).toBe(400);
    expect(mocks.mark).not.toHaveBeenCalled();
  });
  it("reports persistence failure instead of confirming a read", async () => {
    mocks.mark.mockRejectedValue(new Error("fixture rejection"));
    expect((await POST(request({ ids: ["a"] }))).status).toBe(503);
  });
});
