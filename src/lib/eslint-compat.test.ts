import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
it("keeps the installed adapter and all original directory-glob fixtures equivalent", () => {
  expect(
    execFileSync(process.execPath, ["tools/eslint-fast-glob-compat/verify-install.mjs"], {
      encoding: "utf8",
    }),
  ).toContain("match");
  expect(
    execFileSync(process.execPath, ["tools/eslint-fast-glob-compat/verify.mjs"], {
      encoding: "utf8",
    }),
  ).toContain("Passed 234");
});
it("retains actual Next rule diagnostics across literal, glob, array and normalised roots", () => {
  expect(
    execFileSync(process.execPath, ["tools/eslint-fast-glob-compat/verify-next.mjs"], {
      encoding: "utf8",
    }),
  ).toContain("Passed 35");
});
