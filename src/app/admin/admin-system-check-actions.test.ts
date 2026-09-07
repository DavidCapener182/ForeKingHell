import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ record: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/admin-system-checks", () => ({ recordAdminSystemSnapshot: mocks.record }));
import { runAdminSystemSnapshotAction } from "./admin-system-check-actions";
beforeEach(() => vi.resetAllMocks());
it("announces only a recorded check and its actual timestamp", async () => {
  mocks.record.mockResolvedValue({
    checkedAt: "2026-09-07T12:00:00.000Z",
    liveChecks: [{ state: "passed" }, { state: "failed" }, { state: "unavailable" }],
  });
  const result = await runAdminSystemSnapshotAction();
  expect(result.ok).toBe(true);
  expect(result.checkedAt).toBe("2026-09-07T12:00:00.000Z");
  expect(result.message).toContain("1 read-only probes passed, 1 failed, 1 unavailable");
  expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith("/admin/system-checks");
});
it("does not publish success or refresh when the record cannot be saved", async () => {
  mocks.record.mockRejectedValue(new Error("private storage detail"));
  const result = await runAdminSystemSnapshotAction({ ok: true, message: "old" }, new FormData());
  expect(result.ok).toBe(false);
  expect(result.checkedAt).toBeUndefined();
  expect(result.message).toBeUndefined();
  expect(result.error).not.toContain("private storage detail");
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it("retains the saved outcome if revalidation fails", async () => {
  mocks.record.mockResolvedValue({ checkedAt: "2026-09-07T12:00:00.000Z", liveChecks: [] });
  mocks.refresh.mockImplementation(() => {
    throw new Error("refresh failed");
  });
  expect((await runAdminSystemSnapshotAction()).ok).toBe(true);
});
