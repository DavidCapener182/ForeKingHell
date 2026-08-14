import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/bag/[clubId]/club-detail-client.tsx"),
  "utf8",
);

describe("club profile desktop helper bundle", () => {
  it("ships only the desktop club decision and analysis path", () => {
    expect(source).toContain("data-desktop-club-profile");
    expect(source).toContain("<RangeToggle");
    expect(source).toContain('aria-label="Shot date range"');
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
    expect(source).toContain("<ToggleGroup");
    expect(source).toContain("<ToggleGroupItem");
    expect(source).toContain("<Badge");
    expect(source).toContain("<Progress");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).toContain("var(--status-error-surface)");
    expect(source).toContain("var(--status-information-surface)");
  });
});
