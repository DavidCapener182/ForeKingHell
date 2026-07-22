import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const budgets = JSON.parse(
  readFileSync(join(root, "config/route-js-budgets.json"), "utf8"),
) as Record<string, number>;
const script = readFileSync(join(root, "scripts/check-route-budgets.mjs"), "utf8");
const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");

describe("route JavaScript budgets", () => {
  it("covers the public entry and core post-session product loop", () => {
    for (const route of [
      "/",
      "/login",
      "/today",
      "/import",
      "/analyse",
      "/coach",
      "/practice",
      "/progress",
    ]) {
      expect(budgets[route]).toBeGreaterThan(0);
    }
  });

  it("uses Next build diagnostics and blocks CI regressions", () => {
    expect(script).toContain("route-bundle-stats.json");
    expect(script).toContain("firstLoadUncompressedJsBytes");
    expect(ci).toContain("npm run check:route-budgets");
  });
});
