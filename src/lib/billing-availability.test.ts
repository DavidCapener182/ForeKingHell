import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { billingPlans, getCheckoutAvailability } from "./billing";
afterEach(() => vi.unstubAllEnvs());
it("requires the provider key and each exact interval price without exposing configuration", () => {
  for (const plan of billingPlans)
    for (const name of Object.values(plan.priceEnv)) vi.stubEnv(name, "");
  vi.stubEnv("STRIPE_SECRET_KEY", "synthetic-secret");
  expect(Object.values(getCheckoutAvailability()).every((row) => !row.monthly && !row.yearly)).toBe(
    true,
  );
  const pro = billingPlans.find((plan) => plan.key === "pro")!;
  vi.stubEnv(pro.priceEnv.yearly!, "synthetic-price");
  expect(getCheckoutAvailability().pro).toEqual({ monthly: false, yearly: true });
  expect(getCheckoutAvailability().free).toEqual({ monthly: false, yearly: false });
  expect(getCheckoutAvailability().full).toEqual({ monthly: false, yearly: false });
  expect(JSON.stringify(getCheckoutAvailability())).not.toContain("synthetic");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  expect(getCheckoutAvailability().pro.yearly).toBe(false);
});
