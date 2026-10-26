import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/db/client", () => ({ getDb: () => db }));
import { proFeatureStorageReady } from "./pro-feature-readiness";
import {
  getProTrialEligibility,
  markTrialConsumed,
  markTrialEligibleAfterFirstImport,
  reserveProTrialCheckout,
} from "./billing-pro-trial";
beforeEach(() => {
  vi.clearAllMocks();
  db.execute.mockResolvedValue([{ ready: false }]);
});
it("hides trial offers before schema rollout without touching absent tables", async () => {
  expect(await getProTrialEligibility("owner", "free")).toMatchObject({
    eligible: false,
    configured: false,
    storageReady: false,
  });
  expect(db.select).not.toHaveBeenCalled();
});
it("keeps ordinary imports and trusted webhook grants independent of missing optional trial storage", async () => {
  expect(await markTrialEligibleAfterFirstImport("owner")).toBe(false);
  expect(
    await markTrialConsumed({
      userId: "owner",
      subscriptionId: "sub",
      startedAt: new Date(),
      endsAt: new Date(),
    }),
  ).toBe(false);
  expect(db.insert).not.toHaveBeenCalled();
  expect(db.transaction).not.toHaveBeenCalled();
});
it("blocks trial checkout before a transaction or Stripe request when storage is unavailable", async () => {
  await expect(reserveProTrialCheckout("owner")).rejects.toThrow(/temporarily unavailable/);
  expect(db.transaction).not.toHaveBeenCalled();
});
it("requires an explicit boolean readiness result", async () => {
  db.execute.mockResolvedValueOnce([{ ready: true }]).mockResolvedValueOnce([{ ready: null }]);
  expect(await proFeatureStorageReady()).toBe(true);
  expect(await proFeatureStorageReady()).toBe(false);
});
