import { describe, expect, it } from "vitest";

import {
  hashReportPassword,
  parseCoachReportAccessConfig,
  reportAccessGrant,
  verifyReportPassword,
} from "@/lib/coach-report-access";

describe("coach report access", () => {
  it("hashes and verifies report passwords without storing plaintext", () => {
    const stored = hashReportPassword("range-proof-2026");
    expect(stored).not.toContain("range-proof-2026");
    expect(verifyReportPassword("range-proof-2026", stored!)).toBe(true);
    expect(verifyReportPassword("wrong-password", stored!)).toBe(false);
  });

  it("normalises privacy controls and deterministic access grants", () => {
    const config = parseCoachReportAccessConfig({
      template: "tournament",
      disableDownload: true,
      accessHistory: ["2026-07-21T12:00:00.000Z", "invalid"],
    });
    expect(config).toMatchObject({
      template: "tournament",
      disableDownload: true,
      hideExactShotData: true,
    });
    expect(config.accessHistory).toEqual(["2026-07-21T12:00:00.000Z"]);
    expect(reportAccessGrant("token", "password")).toHaveLength(64);
  });
});
