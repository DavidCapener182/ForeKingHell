import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const actions = readFileSync(path.join(root, "src/app/coach/reports/actions.ts"), "utf8");
const publicPage = readFileSync(path.join(root, "src/app/share/report/[token]/page.tsx"), "utf8");

describe("coach report sharing boundary", () => {
  it("scopes creation and revocation to the current owner", () => {
    expect(actions).toContain("requireCurrentUserId()");
    expect(actions).toContain("eq(shareLinks.userId, userId)");
    expect(actions).toContain('eq(shareLinks.resourceType, "coach_report")');
  });

  it("serves only ready, unrevoked, unexpired coach-report snapshots", () => {
    expect(publicPage).toContain('eq(shareLinks.resourceType, "coach_report")');
    expect(publicPage).toContain("isNull(shareLinks.revokedAt)");
    expect(publicPage).toContain("gt(shareLinks.expiresAt, now)");
    expect(publicPage).toContain('eq(contentExports.sourceType, "coach_report")');
    expect(publicPage).not.toContain("requireCurrentUserId");
  });
});
