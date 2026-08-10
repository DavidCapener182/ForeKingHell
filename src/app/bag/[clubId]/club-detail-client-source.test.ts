import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/bag/[clubId]/club-detail-client.tsx"),
  "utf8",
);

describe("club profile mobile composition", () => {
  it("puts the club decision ahead of the specialist analysis and uses a native range control", () => {
    const range = source.indexOf("<MobileRangePicker");
    const decision = source.indexOf("<MobileClubDecision");
    const analysis = source.indexOf("<ClubAnalysisTabs");

    expect(source).toContain('aria-label="Shot date range"');
    expect(source).toContain("min-h-11");
    expect(source).toContain("data-mobile-club-decision");
    expect(source).toContain('label="Personal best"');
    expect(source).not.toContain("MobileMetricStrip");
    expect(source).toContain("mobileSupport={");
    expect(source).toContain("<MobileClubSupport");
    expect(range).toBeGreaterThan(-1);
    expect(decision).toBeGreaterThan(range);
    expect(analysis).toBeGreaterThan(decision);
  });
});
