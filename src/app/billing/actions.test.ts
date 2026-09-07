import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ checkout: vi.fn(), portal: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/site-origin", () => ({ getSiteOrigin: () => "http://localhost:3116" }));
vi.mock("@/lib/billing", () => ({
  billingIntervals: ["monthly", "yearly"],
  createCheckoutSession: mocks.checkout,
  createCustomerPortalSession: mocks.portal,
}));
import { createCheckoutFormAction, openCustomerPortalFormAction } from "./actions";
const form = (values: Record<string, string>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};
beforeEach(() => vi.resetAllMocks());
it.each([
  { planKey: "full", interval: "yearly" },
  { planKey: "free", interval: "monthly" },
  { planKey: "pro", interval: "bad" },
  { planKey: "unknown", interval: "monthly" },
])("rejects nonpurchasable/invalid selection %#", async (values) => {
  expect((await createCheckoutFormAction({ ok: true, url: "old" }, form(values))).ok).toBe(false);
  expect(mocks.checkout).not.toHaveBeenCalled();
});
it("preserves selected interval and returns only confirmed checkout URL", async () => {
  mocks.checkout.mockResolvedValue({
    url: "/billing?checkout=error",
    error: "Provider unavailable",
  });
  const data = form({ planKey: "pro", interval: "yearly" });
  expect(await createCheckoutFormAction({ ok: true, url: "old" }, data)).toEqual({
    ok: false,
    error: "Could not start checkout. Your plan has not changed. Try again later.",
  });
  expect(mocks.checkout).toHaveBeenCalledWith({
    planKey: "pro",
    interval: "yearly",
    origin: "http://localhost:3116",
  });
  mocks.checkout.mockResolvedValue({ url: "https://checkout.stripe.com/synthetic", error: null });
  expect(await createCheckoutFormAction({ ok: false, error: "old" }, data)).toEqual({
    ok: true,
    url: "https://checkout.stripe.com/synthetic",
  });
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it("portal failures never expose a stale success URL", async () => {
  mocks.portal.mockResolvedValue({ url: "/billing?portal=missing-customer", error: "No customer" });
  expect(await openCustomerPortalFormAction({ ok: true, url: "old" }, new FormData())).toEqual({
    ok: false,
    error: "Could not open billing management. Try again later.",
  });
  mocks.portal.mockRejectedValue(new Error("Network failed"));
  expect(await openCustomerPortalFormAction({ ok: true }, new FormData())).toEqual({
    ok: false,
    error: "Could not open billing management. Try again later.",
  });
  mocks.portal.mockResolvedValue({ url: "https://billing.stripe.com/synthetic", error: null });
  expect(await openCustomerPortalFormAction({ ok: false }, new FormData())).toEqual({
    ok: true,
    url: "https://billing.stripe.com/synthetic",
  });
});
