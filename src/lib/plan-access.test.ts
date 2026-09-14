import { describe, expect, it, vi } from "vitest";
import { paidFeatures, planHasFeature, type PaidFeature } from "@/lib/plan-access";
import { planEntitlements } from "@/lib/plan-entitlements";
import { resolveActivePlanKey } from "@/lib/billing";
import type { PlanKey } from "@/lib/billing-plan-catalog";

const plans: PlanKey[] = ["free", "plus", "pro", "coach", "full"];
const expected: Record<PaidFeature, boolean[]> = {
  advanced_analytics: [false, true, true, true, true],
  private_competitions: [false, true, true, true, true],
  share_customisation: [false, true, true, true, true],
  selective_reports: [false, true, true, true, true],
  player_comparison: [false, false, true, true, true],
  premium_imports: [false, false, true, true, true],
  coach_workspace: [false, false, false, true, true],
  major_hosting: [false, false, false, true, true],
};

describe("subscription access matrix", () => {
  for (const feature of Object.keys(paidFeatures) as PaidFeature[]) {
    it(`${feature} unlocks at its advertised tier and remains available above it`, () => {
      expect(plans.map((plan) => planHasFeature(plan, feature))).toEqual(expected[feature]);
    });
  }
  it("higher tiers retain all lower-tier boolean entitlements", () => {
    for (let tier = 1; tier < plans.length; tier++) {
      const higher = new Map<string, Record<string, unknown>>(planEntitlements[plans[tier]]);
      for (const [key, value] of planEntitlements[plans[tier - 1]]) {
        if (value.value === true)
          expect(higher.get(key)?.value, `${plans[tier]}:${key}`).toBe(true);
      }
    }
  });
  it.each(["canceled", "past_due", "unpaid", "incomplete", "incomplete_expired", "paused"])(
    "revokes paid access for %s despite saved paid entitlement rows",
    (status) => {
      expect(
        resolveActivePlanKey({ planKey: "coach", status }, [
          { entitlementKey: "coach_dashboard", valueJson: { value: true }, expiresAt: null },
        ]),
      ).toBe("free");
    },
  );
  it.each(["active", "trialing"])("uses the current plan for %s", (status) => {
    for (const plan of plans)
      expect(resolveActivePlanKey({ planKey: plan, status }, [])).toBe(plan);
  });
  it("ignores expired lifetime grants and preserves active owner grants", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T00:00:00Z"));
    try {
      const row = {
        entitlementKey: "lifetime_full",
        valueJson: { value: true },
        expiresAt: new Date("2026-09-13T00:00:00Z"),
      };
      expect(resolveActivePlanKey(null, [row])).toBe("free");
      expect(resolveActivePlanKey(null, [{ ...row, expiresAt: null }])).toBe("full");
    } finally {
      vi.useRealTimers();
    }
  });
});
