import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("production readiness gate", () => {
  it("runs the full launch verification command set and warns on missing auth state", () => {
    const script = readFileSync(join(root, "scripts/production-readiness-check.mjs"), "utf8");

    for (const expected of [
      '"format:check"',
      '"lint"',
      '"tsc", "--noEmit"',
      '"test"',
      '"build"',
      '"test:e2e"',
      '"test:lighthouse"',
      '"diff", "--check"',
      "Authenticated E2E not fully verified because PLAYWRIGHT_AUTH_STATE is missing.",
    ]) {
      expect(script).toContain(expected);
    }
  });

  it("keeps OpenAI-backed routes rate-limited and size-limited", () => {
    for (const route of [
      "src/app/api/coach/chat/route.ts",
      "src/app/api/coach/summary/route.ts",
      "src/app/api/scorecard/extract/route.ts",
    ]) {
      const source = readFileSync(join(root, route), "utf8");

      expect(source).toContain("rateLimitRequest");
      expect(source).toContain("rejectOversizedRequest");
    }

    expect(readFileSync(join(root, "src/app/api/scorecard/extract/route.ts"), "utf8")).toContain(
      "rejectOversizedDataUrl",
    );
  });

  it("keeps Stripe webhook handling signature-gated", () => {
    const source = readFileSync(join(root, "src/app/api/stripe/webhook/route.ts"), "utf8");

    expect(source).toContain("verifyStripeSignature");
    expect(source).toContain("stripe-signature");
    expect(source).toContain("Invalid Stripe signature.");
  });

  it("keeps tester-facing settings privacy controls visible", () => {
    const source = readFileSync(join(root, "src/app/settings/page.tsx"), "utf8");

    expect(source).toContain("Visibility simulator");
    expect(source).toContain("Data export/delete status");
    expect(source).toContain("Private by default");
    expect(source).toContain("Friends do not get account access");
  });
});
