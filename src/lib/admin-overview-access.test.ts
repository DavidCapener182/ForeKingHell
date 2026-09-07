import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  db: vi.fn(),
  select: vi.fn(),
  limit: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: mocks.identity }));
vi.mock("@/db/client", () => ({ getDb: mocks.db }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
import { getAdminOverviewData, getAdminOperationsSnapshot } from "./admin";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.identity.mockResolvedValue("synthetic-user");
  mocks.limit.mockResolvedValue([]);
  mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: mocks.limit }) }) });
  mocks.db.mockReturnValue({ select: mocks.select, execute: mocks.execute });
});
it.each([getAdminOverviewData, getAdminOperationsSnapshot])(
  "denies an account without active admin access before reading operational totals",
  async (read) => {
    await expect(read()).rejects.toThrow("redirect:/dashboard");
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.execute).not.toHaveBeenCalled();
  },
);
it.each([getAdminOverviewData, getAdminOperationsSnapshot])(
  "does not open the database when authentication fails",
  async (read) => {
    mocks.identity.mockRejectedValue(new Error("Sign in required"));
    await expect(read()).rejects.toThrow("Sign in required");
    expect(mocks.db).not.toHaveBeenCalled();
  },
);
