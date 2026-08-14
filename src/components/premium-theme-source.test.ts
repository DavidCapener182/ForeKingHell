import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/premium.tsx"), "utf8");

function componentSource(start: string, end: string) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe("premium shared theme surfaces", () => {
  it("keeps page-header media rings semantic across desktop and mobile companions", () => {
    const pageHeader = componentSource(
      "export function PageHeader",
      "export function MobileCompactPageHeader",
    );
    const mobileHeader = componentSource(
      "export function MobileCompactPageHeader",
      "export function MobileSectionChips",
    );
    const companionHero = componentSource(
      "export function MobileCompanionHero",
      "export function MobileQuickDecisionCard",
    );

    expect(pageHeader).toContain("ring-border/80");
    expect(mobileHeader).toContain("ring-border/80");
    expect(`${pageHeader}${mobileHeader}${companionHero}`).not.toMatch(
      /(?:ring|border|bg|text)-(?:white|slate|emerald)-/,
    );
  });

  it("uses the semantic accent hover for linked compact readouts", () => {
    const readouts = componentSource(
      "export function CompactReadoutGrid",
      "export function CompactLinkGrid",
    );

    expect(readouts).toContain("hover:bg-accent/60");
    expect(readouts).not.toContain("hover:bg-emerald");
    expect(readouts).toContain("group-hover:text-primary");
  });
});
