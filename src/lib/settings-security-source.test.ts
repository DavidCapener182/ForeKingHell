import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/settings/actions.ts"), "utf8");

describe("settings destructive and collaboration controls", () => {
  it("atomically claims a pending, unexpired invitation before granting membership", () => {
    expect(source).toContain("const claimedInvitations = await tx");
    expect(source).toContain('eq(accountInvitations.status, "pending")');
    expect(source).toContain("gt(accountInvitations.expiresAt, claimNow)");
    expect(source).toContain("if (claimedInvitations.length === 0)");
  });

  it("preserves third-party reports and moderation evidence during self-service deletion", () => {
    expect(source).not.toContain(".delete(socialReports)");
    expect(source).not.toContain(".delete(moderationEvents)");
  });
});
