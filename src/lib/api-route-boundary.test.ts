import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const proxySource = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");

describe("public API boundary", () => {
  it("contains only the reviewed exact public API endpoints", () => {
    const publicSetBody = proxySource.match(/const PUBLIC_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1];
    expect(publicSetBody).toBeTruthy();
    const publicApiPaths = [...(publicSetBody ?? "").matchAll(/"(\/api\/[^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(publicApiPaths.sort()).toEqual(
      [
        "/api/cron/course-twin-builds",
        "/api/cron/course-twin-catalog",
        "/api/cron/tour-leaderboards",
        "/api/security/csp-report",
        "/api/stripe/webhook",
      ].sort(),
    );
    const publicPrefixes = proxySource.match(/const PUBLIC_PATH_PREFIXES = \[([\s\S]*?)\];/)?.[1];
    expect(publicPrefixes).not.toContain("/api/");
  });
});
