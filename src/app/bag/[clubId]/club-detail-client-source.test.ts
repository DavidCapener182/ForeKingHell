import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/bag/[clubId]/club-detail-client.tsx"),
  "utf8",
);

describe("club profile desktop helper bundle", () => {
  it("shares range-filtered shot evidence across the selected club composition", () => {
    expect(source).toContain("if (companion)");
    expect(source).toContain("data-mobile-club-detail");
    expect(source).toContain("filterShotsForRange(orderedShots, shotRange, new Date())");
    expect(source.match(/shots={selectedShots}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain("<RangeToggle");
    expect(source).toContain('label="Shot date range"');
    expect(source).toContain("<ClubAnalysisTabs");
    expect(source).toContain("afterDispersion={");

    for (const unreachableMobileSymbol of [
      "MobileCompactPageHeader",
      "MobileRangePicker",
      "MobileClubDecision",
      "MobileClubSupport",
      "mobileSupport",
      "IOSGroupedList",
      "IOSInlineStatus",
      "IOSListRow",
      "IOSSectionHeader",
      "@/components/app/ios-mobile",
      "lg:hidden",
      "premium-hero hidden",
    ]) {
      expect(source).not.toContain(unreachableMobileSymbol);
    }
  });

  it("uses theme-semantic shadcn controls and status surfaces for imported club helpers", () => {
    const fixedPalette =
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#|rgba\(|#[0-9a-f]{3,8}/i;

    expect(source).not.toMatch(fixedPalette);
    expect(source).toContain("<UntitledSelect");
    expect(source).toContain("onValueChange={(next) => onChange(next as ShotRange)}");
    expect(source).toContain("<Badge");
    expect(source).toContain("<Progress");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).toContain("var(--status-error-surface)");
    expect(source).toContain("var(--status-information-surface)");
  });
});
