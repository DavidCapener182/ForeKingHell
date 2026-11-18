import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";

describe("nonrecursive tooling glob boundary", () => {
  it("preserves reviewed consumer behavior and rejects resource abuse", () => {
    const output = execFileSync(process.execPath, ["tools/nonrecursive-glob-compat/verify.cjs"], {
      encoding: "utf8",
      timeout: 20000,
    });
    expect(JSON.parse(output).failures).toEqual([]);
  }, 25000);
});
