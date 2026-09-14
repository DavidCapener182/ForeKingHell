import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getPlan: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/billing", () => ({ getActivePlanKeyForUser: mocks.getPlan }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: mocks.user }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
import {
  planFeatureRejection,
  requirePlanFeature,
  requirePlanUser,
} from "@/lib/require-plan-access";

describe("server-side subscription boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue("signed-in-user");
  });
  it("rejects direct API access with a usable 403", async () => {
    mocks.getPlan.mockResolvedValue("free");
    const response = await planFeatureRejection("signed-in-user", "share_customisation");
    expect(response?.status).toBe(403);
    expect(await response?.json()).toMatchObject({ code: "PLAN_REQUIRED", minimumPlan: "plus" });
  });
  it("authenticates and rejects lower-tier server actions before returning the user", async () => {
    mocks.getPlan.mockResolvedValue("plus");
    await expect(requirePlanUser("coach_workspace")).rejects.toThrow("/billing?required=coach");
    expect(mocks.getPlan).toHaveBeenCalledWith("signed-in-user");
  });
  it("admits higher tiers and rechecks after a downgrade", async () => {
    mocks.getPlan.mockResolvedValueOnce("coach").mockResolvedValueOnce("free");
    await expect(requirePlanFeature("signed-in-user", "major_hosting")).resolves.toBeUndefined();
    await expect(requirePlanFeature("signed-in-user", "major_hosting")).rejects.toThrow(
      "REDIRECT:",
    );
  });
  it("fails closed when the subscription lookup fails", async () => {
    mocks.getPlan.mockRejectedValue(new Error("Database unavailable"));
    await expect(planFeatureRejection("signed-in-user", "advanced_analytics")).rejects.toThrow(
      "Database unavailable",
    );
  });
});
