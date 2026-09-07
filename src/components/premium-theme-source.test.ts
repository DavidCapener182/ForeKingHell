import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/premium.tsx"), "utf8");

function componentSource(start: string, end: string) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe("premium shared theme surfaces", () => {
  it("keeps page-header media rings semantic across desktop and mobile companions", () => {
    const pageHeader = readFileSync(
      join(process.cwd(), "src/components/untitled-ui/headers.tsx"),
      "utf8",
    );
    const headerStyles = readFileSync(
      join(process.cwd(), "src/components/untitled-ui/headers.module.css"),
      "utf8",
    );
    expect(source).toContain("export { UntitledPageHeader as PageHeader }");
    const mobileHeader = componentSource(
      "export function MobileCompactPageHeader",
      "export function MobileSectionChips",
    );
    const companionHero = componentSource(
      "export function MobileCompanionHero",
      "export function MobileQuickDecisionCard",
    );

    expect(headerStyles).toContain("border: 1px solid var(--border)");
    expect(headerStyles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
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
