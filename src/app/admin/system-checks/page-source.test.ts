import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/admin/system-checks/page.tsx"), "utf8");

describe("admin system checks desktop console source", () => {
  it("adds a protected provider health and system checks console", () => {
    expect(source).toContain("getAdminOperationsSnapshot");
    expect(source).toContain('<AdminNav active="/admin/system-checks" />');
    expect(source).toContain('scope="admin-system-checks"');
    expect(source).toContain("Provider health and platform checks");
    expect(source).toContain("Provider failures");
    expect(source).toContain("Billing failures");
    expect(source).toContain("RLS/test status");
    expect(source).toContain('href="/providers#provider-health"');
    expect(source).toContain('href="/providers#provider-jobs"');
  });

  it("keeps admin recommendations tied to visible evidence", () => {
    expect(source).toContain("Admin recommendations should cite visible provider counts");
    expect(source).toContain("Do not infer a provider outage from missing data alone");
    expect(source).toContain("only active owner or operator");
  });
});
