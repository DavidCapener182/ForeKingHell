import { describe, expect, it } from "vitest";
import { proTrialEligibility, isProTrialSubscription } from "./billing-pro-trial-policy";
const firstImport = new Date("2026-10-16T00:00:00Z");
const base = {
  activePlanKey: "free" as const,
  eligibleAfterImportAt: firstImport,
  consumedAt: null,
  priorTrial: false,
};
describe("one Pro trial per account", () => {
  it("requires a successful first import", () =>
    expect(proTrialEligibility({ ...base, eligibleAfterImportAt: null }).eligible).toBe(false));
  it("offers a trial to an eligible Free account", () =>
    expect(proTrialEligibility(base)).toMatchObject({ eligible: true, consumed: false }));
  it.each(["plus", "pro", "coach", "full"] as const)(
    "does not offer a trial on %s",
    (activePlanKey) => expect(proTrialEligibility({ ...base, activePlanKey }).eligible).toBe(false),
  );
  it("never reoffers a consumed trial", () =>
    expect(proTrialEligibility({ ...base, consumedAt: firstImport }).eligible).toBe(false));
  it("recognises a trial in historical subscription evidence", () =>
    expect(proTrialEligibility({ ...base, priorTrial: true }).consumed).toBe(true));
  it("does not burn a trial for paid Pro without a trial", () => {
    expect(isProTrialSubscription("pro", "active", {})).toBe(false);
    expect(proTrialEligibility(base).eligible).toBe(true);
  });
  it("recognises trialing, trial metadata and Stripe trial_start evidence", () => {
    expect(isProTrialSubscription("pro", "trialing", {})).toBe(true);
    expect(isProTrialSubscription("pro", "canceled", { metadata: { trial: "pro_7d" } })).toBe(true);
    expect(isProTrialSubscription("pro", "active", { trialStart: 123 })).toBe(true);
    expect(isProTrialSubscription("plus", "active", { trialStart: 123 })).toBe(false);
  });
});
