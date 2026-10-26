import { describe, expect, it } from "vitest";
import { resolveActivePlanKey } from "./billing";
describe("trial access expiry", () => {
  it("grants trialing Pro before its confirmed end", () =>
    expect(
      resolveActivePlanKey(
        { planKey: "pro", status: "trialing", currentPeriodEnd: new Date(Date.now() + 86400000) },
        [],
      ),
    ).toBe("pro"));
  it("returns to Free at the trial end even if the next webhook is delayed", () =>
    expect(
      resolveActivePlanKey(
        { planKey: "pro", status: "trialing", currentPeriodEnd: new Date(Date.now() - 1000) },
        [],
      ),
    ).toBe("free"));
  it("preserves the existing active paid subscription behavior", () =>
    expect(
      resolveActivePlanKey({ planKey: "pro", status: "active", currentPeriodEnd: new Date(0) }, []),
    ).toBe("pro"));
  it("preserves an independent Lifetime Full grant", () =>
    expect(
      resolveActivePlanKey({ planKey: "pro", status: "trialing", currentPeriodEnd: new Date(0) }, [
        { entitlementKey: "lifetime_full", valueJson: { value: true }, expiresAt: null },
      ]),
    ).toBe("full"));
});
