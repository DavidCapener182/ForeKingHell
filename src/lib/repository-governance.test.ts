import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("repository governance", () => {
  it("assigns code owners to the default tree and security-sensitive boundaries", () => {
    const source = readFileSync(join(root, ".github/CODEOWNERS"), "utf8");

    for (const rule of [
      "* @DavidCapener182",
      "/proxy.ts @DavidCapener182",
      "/src/app/api/ @DavidCapener182",
      "/src/db/ @DavidCapener182",
      "/drizzle/ @DavidCapener182",
      "/scripts/ @DavidCapener182",
      "/.github/workflows/ @DavidCapener182",
      "/SECURITY.md @DavidCapener182",
      "/public/.well-known/security.txt @DavidCapener182",
    ]) {
      expect(source).toContain(rule);
    }
  });

  it("documents compulsory main-branch checks and runs them for merge queues", () => {
    const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    const security = readFileSync(join(root, ".github/workflows/security.yml"), "utf8");
    const protection = readFileSync(join(root, "docs/GITHUB_BRANCH_PROTECTION.md"), "utf8");

    expect(ci).toContain("merge_group:");
    expect(ci).toContain("permissions:\n  contents: read");
    expect(ci).toContain("npm audit --audit-level=high");
    expect(ci).toContain("name: Core Playwright");
    expect(ci).toContain("tests/e2e/ci-core.spec.ts");
    expect(security).toContain("merge_group:");
    expect(protection).toContain("require a pull request before merging");
    expect(protection).toContain("Migrations from zero");
    expect(protection).toContain("Core Playwright");
    expect(protection).toContain("dependency-review");
    expect(protection).toContain("do not allow bypass");
  });
});
