import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  join: vi.fn(),
  code: vi.fn(),
  respond: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/groups", () => ({
  createGroup: mocks.create,
  joinGroup: mocks.join,
  joinGroupByInviteCode: mocks.code,
  respondToGroupInvite: mocks.respond,
  groupTypes: ["friends"],
  createGroupPost: vi.fn(),
  deleteGroup: vi.fn(),
  leaveGroup: vi.fn(),
}));
vi.mock("@/lib/social", () => ({
  parseVisibility: (value: unknown, fallback: string) =>
    ["public", "friends", "private"].includes(String(value)) ? value : fallback,
}));
import { createGroupAction, createGroupFormAction, groupMembershipFormAction } from "./actions";
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ slug: "saved-group" });
  mocks.code.mockResolvedValue("joined-group");
  mocks.respond.mockResolvedValue("invited-group");
});
describe("Groups confirmed form actions", () => {
  it("preserves legacy create input and returns the saved slug without redirecting", async () => {
    const data = form({
      name: " Golfers ",
      description: " Our group ",
      rules: " Be kind ",
      groupType: "invalid",
      visibility: "private",
    });
    await createGroupAction(data);
    const legacy = mocks.create.mock.calls[0][0];
    mocks.redirect.mockClear();
    expect(await createGroupFormAction({ ok: false, error: "Old error" }, data)).toEqual({
      ok: true,
      slug: "saved-group",
    });
    expect(mocks.create.mock.calls[1][0]).toEqual(legacy);
    expect(legacy).toEqual({
      name: "Golfers",
      description: "Our group",
      rules: "Be kind",
      groupType: "friends",
      visibility: "private",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("waits for creation and drops a stale success slug on failure", async () => {
    let reject!: (error: Error) => void;
    mocks.create.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    let settled = false;
    const pending = createGroupFormAction(
      { ok: true, slug: "old" },
      form({ name: "Golfers" }),
    ).then((value) => {
      settled = true;
      return value;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    reject(new Error("Creation unavailable."));
    expect(await pending).toEqual({ ok: false, error: "Creation unavailable." });
  });
  it.each([
    ["join", { groupId: "group", inviteCode: "code" }, "join", ["group", "code"], { ok: true }],
    ["code", { inviteCode: "code" }, "code", ["code"], { ok: true, slug: "joined-group" }],
    [
      "accept",
      { inviteId: "invite" },
      "respond",
      ["invite", "accepted"],
      { ok: true, slug: "invited-group" },
    ],
    ["decline", { inviteId: "invite" }, "respond", ["invite", "declined"], { ok: true }],
  ] as const)(
    "confirms %s through its existing service",
    async (operation, fields, service, args, result) => {
      expect(
        await groupMembershipFormAction({ ok: false }, form({ operation, ...fields })),
      ).toEqual(result);
      expect(mocks[service]).toHaveBeenCalledWith(...args);
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );
  it("returns service permission errors without retaining prior navigation", async () => {
    mocks.respond.mockRejectedValue(new Error("Invite not found."));
    expect(
      await groupMembershipFormAction(
        { ok: true, slug: "old" },
        form({ operation: "accept", inviteId: "foreign" }),
      ),
    ).toEqual({ ok: false, error: "Invite not found." });
  });
  it("rejects unsupported operations and missing identities", async () => {
    expect((await groupMembershipFormAction({ ok: false }, form({ operation: "delete" }))).ok).toBe(
      false,
    );
    expect((await groupMembershipFormAction({ ok: false }, form({ operation: "join" }))).ok).toBe(
      false,
    );
    expect(mocks.join).not.toHaveBeenCalled();
  });
});
