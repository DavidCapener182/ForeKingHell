import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("app shell account data", () => {
  it("does not timeout authenticated sidebar identity to fake level 1 XP", () => {
    const source = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

    expect(source).toContain("await getAppShellData()");
    expect(source).not.toContain("getAppShellDataWithTimeout");
    expect(source).not.toContain("Promise.race");
    expect(source).not.toContain("appShellDataTimeoutMs");
  });
});
