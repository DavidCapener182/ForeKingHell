import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { globSync } from "../../tools/eslint-fast-glob-compat/index.js";
it("rejects nested and expansive roots explicitly instead of overflowing or silently dropping lint roots", () => {
  for (const pattern of [
    "{".repeat(500) + "a,b" + "}".repeat(500),
    "(".repeat(500) + "x" + ")".repeat(500),
    "{a,b}".repeat(20),
    "{1..20000}",
    "x".repeat(10001),
  ]) {
    expect(() => globSync(pattern, { onlyDirectories: true })).toThrow(/resource limit exceeded/);
  }
  expect(globSync("src/app", { onlyDirectories: true })).toEqual(["src/app"]);
});
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

it("retains unnormalized roots and skips unmatched hidden symlink traversal", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fkh-lint-roots-"));
  try {
    fs.mkdirSync(path.join(root, "apps/site/pages"), { recursive: true });
    fs.symlinkSync(path.join(root, "apps"), path.join(root, "apps/.cache"), "dir");
    const unnormalized = `${root}/apps/missing/../site`;
    expect(globSync(unnormalized, { onlyDirectories: true })).toEqual([unnormalized]);
    expect(globSync(`${root}/apps/*/pages`, { onlyDirectories: true })).toEqual([
      `${root}/apps/site/pages`,
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
