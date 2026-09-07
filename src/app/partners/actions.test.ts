import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sponsor: vi.fn(), offer: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));
vi.mock("@/lib/partners", () => ({
  createSponsor: mocks.sponsor,
  createPartnerOffer: mocks.offer,
  recordOfferClick: vi.fn(),
}));
import { partnerFormAction } from "./actions";
beforeEach(() => vi.resetAllMocks());
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
it("preserves sponsor fields and confirms only after save", async () => {
  expect(
    await partnerFormAction(
      { ok: false },
      form({
        operation: "sponsor",
        name: "Sponsor",
        websiteUrl: "https://example.invalid",
        contactEmail: "sponsor@example.invalid",
      }),
    ),
  ).toEqual({ ok: true, message: "Sponsor created." });
  expect(mocks.sponsor).toHaveBeenCalledExactlyOnceWith({
    name: "Sponsor",
    websiteUrl: "https://example.invalid",
    contactEmail: "sponsor@example.invalid",
  });
});
it("preserves offer context and does not leak storage failure details", async () => {
  const data = form({
    operation: "offer",
    sponsorId: "sponsor",
    title: "Offer",
    description: "Description",
    offerType: "discount",
    targetContext: "practice",
    offerUrl: "https://example.invalid/offer",
    couponCode: "GOLF",
  });
  mocks.offer.mockRejectedValue(new Error("private database detail"));
  expect(await partnerFormAction({ ok: true, message: "old" }, data)).toEqual({
    ok: false,
    error: "The partner changes could not be saved. Try again.",
  });
  expect(mocks.offer).toHaveBeenCalledWith({
    sponsorId: "sponsor",
    title: "Offer",
    description: "Description",
    offerType: "discount",
    targetContext: "practice",
    offerUrl: "https://example.invalid/offer",
    couponCode: "GOLF",
  });
  mocks.offer.mockResolvedValue(undefined);
  expect((await partnerFormAction({ ok: false }, data)).ok).toBe(true);
});
it("rejects unsafe destinations and unsupported offer types before service calls", async () => {
  expect(
    (
      await partnerFormAction(
        { ok: false },
        form({ operation: "sponsor", name: "Sponsor", websiteUrl: "javascript:alert(1)" }),
      )
    ).ok,
  ).toBe(false);
  expect(
    (
      await partnerFormAction(
        { ok: false },
        form({ operation: "offer", sponsorId: "sponsor", title: "Offer", offerType: "unknown" }),
      )
    ).ok,
  ).toBe(false);
  expect(mocks.sponsor).not.toHaveBeenCalled();
  expect(mocks.offer).not.toHaveBeenCalled();
});
it("rejects malformed email and overlength fields without saving truncated values", async () => {
  for (const contactEmail of ["missing-at.example.com", "a@", "a b@example.com"]) {
    expect(
      (
        await partnerFormAction(
          { ok: false },
          form({ operation: "sponsor", name: "Sponsor", contactEmail }),
        )
      ).ok,
    ).toBe(false);
  }
  expect(
    (await partnerFormAction({ ok: false }, form({ operation: "sponsor", name: "x".repeat(161) })))
      .ok,
  ).toBe(false);
  for (const [field, length] of [
    ["title", 161],
    ["targetContext", 81],
    ["couponCode", 81],
  ] as const) {
    expect(
      (
        await partnerFormAction(
          { ok: false },
          form({
            operation: "offer",
            sponsorId: "sponsor",
            title: "Offer",
            offerType: "discount",
            [field]: "x".repeat(length),
          }),
        )
      ).ok,
    ).toBe(false);
  }
  expect(mocks.sponsor).not.toHaveBeenCalled();
  expect(mocks.offer).not.toHaveBeenCalled();
  expect(
    (
      await partnerFormAction(
        { ok: false },
        form({ operation: "sponsor", name: "x".repeat(160), contactEmail: "" }),
      )
    ).ok,
  ).toBe(true);
});
