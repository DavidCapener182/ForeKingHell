import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), report: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/social-intelligence", () => ({
  generateSocialSummary: mocks.generate,
  reportSocialTarget: mocks.report,
}));
vi.mock("@/lib/social", () => ({
  parseVisibility: (value: unknown, fallback: string) =>
    ["private", "friends", "public"].includes(String(value)) ? value : fallback,
}));
import {
  socialIntelligenceFormAction,
  generateSocialSummaryAction,
  reportSocialTargetAction,
} from "./actions";
const form = (values: Record<string, string>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};
beforeEach(() => vi.resetAllMocks());
it.each(["generate", "report"])(
  "preserves legacy %s payload without redirecting",
  async (operation) => {
    const data = form({
      operation,
      summaryType: " challenge_coach ",
      visibility: "private",
      targetType: " feed ",
      targetId: " source ",
      reason: " spam ",
      details: " details ",
    });
    const service = operation === "generate" ? mocks.generate : mocks.report;
    await (operation === "generate" ? generateSocialSummaryAction : reportSocialTargetAction)(data);
    const expected = service.mock.calls[0][0];
    mocks.redirect.mockClear();
    expect(await socialIntelligenceFormAction({ ok: false }, data)).toEqual({ ok: true });
    expect(service.mock.calls[1][0]).toEqual(expected);
    expect(mocks.redirect).not.toHaveBeenCalled();
  },
);
it.each(["generate", "report"])(
  "waits for %s persistence and returns a recoverable failure",
  async (operation) => {
    let reject!: (reason: Error) => void;
    (operation === "generate" ? mocks.generate : mocks.report).mockImplementation(
      () =>
        new Promise((_, r) => {
          reject = r;
        }),
    );
    let settled = false;
    const result = socialIntelligenceFormAction(
      { ok: true },
      form({ operation, targetType: "feed", targetId: "id", reason: "spam" }),
    ).then((value) => {
      settled = true;
      return value;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    reject(new Error("Save failed"));
    expect(await result).toEqual({ ok: false, error: "Save failed" });
  },
);
it("rejects missing report fields and unknown operations without calling services", async () => {
  expect((await socialIntelligenceFormAction({ ok: true }, form({ operation: "report" }))).ok).toBe(
    false,
  );
  expect((await socialIntelligenceFormAction({ ok: true }, form({ operation: "other" }))).ok).toBe(
    false,
  );
  expect(mocks.report).not.toHaveBeenCalled();
  expect(mocks.generate).not.toHaveBeenCalled();
});
