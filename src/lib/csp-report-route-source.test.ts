import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("CSP report collector boundary", () => {
  it("wires report-only CSP to the exact collector", () => {
    const config = source("next.config.ts");

    expect(config).toContain('"report-uri /api/security/csp-report"');
  });

  it("keeps the public collector bounded and privacy-reducing", () => {
    const route = source("src/app/api/security/csp-report/route.ts");
    const sanitizer = source("src/lib/csp-report.ts");

    expect(route).toContain("16 * 1024");
    expect(route).toContain("rateLimitRequest");
    expect(route).toContain("readBoundedJsonBody");
    expect(route).toContain('reportServerEvent("csp_violation"');
    expect(route).not.toContain("document-uri");
    expect(route).not.toContain("source-file");
    expect(sanitizer).toContain("MAX_REPORTS_PER_REQUEST = 5");
    expect(sanitizer).not.toContain("document-uri");
    expect(sanitizer).not.toContain("source-file");
  });
});
