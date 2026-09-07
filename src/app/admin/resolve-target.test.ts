import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), grant: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));
vi.mock("@/lib/admin", () => ({
  resolveAdminGrantTarget: mocks.resolve,
  grantLifetimeFullAccessByEmail: mocks.grant,
}));
import { resolveAdminGrantTargetAction } from "./actions";
beforeEach(() => vi.resetAllMocks());
const data = () => {
  const form = new FormData();
  form.set("email", "  Target@example.invalid  ");
  return form;
};
it("returns resolved identity without granting access or refreshing records", async () => {
  const target = {
    id: "synthetic",
    displayName: "Synthetic target",
    email: "target@example.invalid",
  };
  mocks.resolve.mockResolvedValue(target);
  expect(await resolveAdminGrantTargetAction(data())).toEqual({ ok: true, target });
  expect(mocks.resolve).toHaveBeenCalledExactlyOnceWith("Target@example.invalid");
  expect(mocks.grant).not.toHaveBeenCalled();
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("returns safe errors without a stale target", async () => {
  mocks.resolve.mockRejectedValue(new Error("database connection sensitive detail"));
  expect(await resolveAdminGrantTargetAction(data())).toEqual({
    ok: false,
    error: "The admin action could not be completed. Try again.",
  });
  mocks.resolve.mockRejectedValue(new Error("No user exists for that email address."));
  expect(await resolveAdminGrantTargetAction(data())).toEqual({
    ok: false,
    error: "No user exists for that email address.",
  });
});
