import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/social", () => ({
  addFeedReaction: vi.fn(),
  removeFeedReaction: vi.fn(),
  addFeedComment: vi.fn(),
  deleteFeedComment: vi.fn(),
  addFeedCommentReaction: vi.fn(),
  removeFeedCommentReaction: vi.fn(),
  updateFeedItemVisibility: vi.fn(),
  deleteFeedItem: vi.fn(),
  hideFeedItem: vi.fn(),
  hideFeedItemType: vi.fn(),
  muteFeedItemUser: vi.fn(),
  reportFeedItem: vi.fn(),
  createStatusUpdate: vi.fn(),
  parseVisibility: (value: unknown, fallback: string) =>
    ["private", "friends", "public"].includes(String(value)) ? value : fallback,
}));
import * as social from "@/lib/social";
import { feedInteractionFormAction } from "./actions";
function form(operation: string) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    operation,
    feedItemId: " feed-id ",
    commentId: " comment-id ",
    body: " Comment body ",
    visibility: "friends",
    reason: " Spam ",
  }))
    data.set(key, value);
  return data;
}
beforeEach(() => vi.resetAllMocks());
describe("confirmed feed interactions", () => {
  it.each([
    ["reaction", "addFeedReaction", ["feed-id"]],
    ["unreact", "removeFeedReaction", ["feed-id"]],
    ["comment", "addFeedComment", ["feed-id", "Comment body"]],
    ["delete-comment", "deleteFeedComment", ["comment-id"]],
    ["comment-reaction", "addFeedCommentReaction", ["comment-id"]],
    ["comment-unreact", "removeFeedCommentReaction", ["comment-id"]],
    ["visibility", "updateFeedItemVisibility", ["feed-id", "friends"]],
    ["delete", "deleteFeedItem", ["feed-id"]],
    ["hide", "hideFeedItem", ["feed-id"]],
    ["hide-type", "hideFeedItemType", ["feed-id"]],
    ["mute", "muteFeedItemUser", ["feed-id"]],
    ["report", "reportFeedItem", ["feed-id", "Spam"]],
  ] as const)(
    "passes %s to its existing service with the right identity",
    async (operation, service, args) => {
      expect(
        await feedInteractionFormAction({ ok: false, error: "Old error" }, form(operation)),
      ).toEqual({ ok: true });
      expect(social[service]).toHaveBeenCalledExactlyOnceWith(...args);
    },
  );
  it("waits for the service and returns its permission failure", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(social.deleteFeedItem).mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    let settled = false;
    const pending = feedInteractionFormAction({ ok: true }, form("delete")).then((value) => {
      settled = true;
      return value;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    reject(new Error("Feed item not found."));
    expect(await pending).toEqual({ ok: false, error: "Feed item not found." });
  });
  it("rejects unsupported operations and missing comment identity", async () => {
    expect((await feedInteractionFormAction({ ok: true }, form("erase"))).ok).toBe(false);
    const data = form("delete-comment");
    data.delete("commentId");
    expect((await feedInteractionFormAction({ ok: true }, data)).ok).toBe(false);
    expect(social.deleteFeedComment).not.toHaveBeenCalled();
  });
});
