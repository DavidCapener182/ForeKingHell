import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/social", () => ({
  sendFriendRequest: mocks.send,
  acceptFriendRequest: vi.fn(),
  blockUser: vi.fn(),
  cancelFriendRequest: vi.fn(),
  declineFriendRequest: vi.fn(),
  followUser: vi.fn(),
  removeFriend: vi.fn(),
  unfollowUser: vi.fn(),
  unblockUser: vi.fn(),
}));
import { sendFriendRequestAction } from "./actions";
beforeEach(() => vi.resetAllMocks());
describe("Friends return path", () => {
  it.each([
    "//outside.example",
    "/\\outside.example",
    "/\n/outside.example",
    "https://outside.example",
  ])("rejects external navigation through %j", async (next) => {
    const form = new FormData();
    form.set("recipientUserId", "recipient");
    form.set("next", next);
    await sendFriendRequestAction(form);
    expect(mocks.redirect).toHaveBeenCalledWith("/friends?request=sent");
  });
  it("preserves a local tab and query after confirmed service completion", async () => {
    const form = new FormData();
    form.set("recipientUserId", "recipient");
    form.set("message", " hello ");
    form.set("next", "/friends?tab=sent&search=Sam#requests");
    await sendFriendRequestAction(form);
    expect(mocks.send).toHaveBeenCalledWith("recipient", "hello");
    expect(mocks.redirect).toHaveBeenCalledWith("/friends?tab=sent&search=Sam#requests");
  });
});

describe("confirmed relationship result", () => {
  it("waits for the service and returns its failure without redirecting", async () => {
    const { relationshipFormAction } = await import("./actions");
    let reject!: (error: Error) => void;
    mocks.send.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const form = new FormData();
    form.set("operation", "request");
    form.set("recipientUserId", "recipient");
    let settled = false;
    const result = relationshipFormAction({ ok: true }, form).then((value) => {
      settled = true;
      return value;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    reject(new Error("Recipient unavailable."));
    expect(await result).toEqual({ ok: false, error: "Recipient unavailable." });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("rejects unknown operations", async () => {
    const { relationshipFormAction } = await import("./actions");
    const form = new FormData();
    form.set("operation", "follow");
    expect(await relationshipFormAction({ ok: true }, form)).toEqual({
      ok: false,
      error: "Unknown relationship operation.",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

it.each([
  ["request", "recipientUserId", "sendFriendRequest"],
  ["accept", "requestId", "acceptFriendRequest"],
  ["decline", "requestId", "declineFriendRequest"],
  ["cancel", "requestId", "cancelFriendRequest"],
  ["remove", "friendUserId", "removeFriend"],
  ["block", "blockedUserId", "blockUser"],
  ["unblock", "blockedUserId", "unblockUser"],
] as const)("confirms %s only through its existing service", async (operation, field, service) => {
  const { relationshipFormAction } = await import("./actions");
  const social = await import("@/lib/social");
  const form = new FormData();
  form.set("operation", operation);
  form.set(field, " target-id ");
  expect(await relationshipFormAction({ ok: false, error: "Old error" }, form)).toEqual({
    ok: true,
  });
  expect(social[service]).toHaveBeenCalledWith(
    ...(operation === "request" ? ["target-id", null] : ["target-id"]),
  );
  expect(mocks.redirect).not.toHaveBeenCalled();
});
