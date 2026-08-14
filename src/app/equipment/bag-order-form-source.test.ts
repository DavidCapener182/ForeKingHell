import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/equipment/bag-order-form.tsx"), "utf8");

describe("bag order form desktop layout", () => {
  it("keeps visual bag slot columns readable before large monitors", () => {
    expect(source).toContain("md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5");
    expect(source).not.toContain("md:grid-cols-2 xl:grid-cols-5");
  });

  it("provides practical touch and non-drag reorder controls", () => {
    expect(source).toContain("data-bag-order-non-drag");
    expect(source).toContain("onValueChange={(value) => moveToSection(club.id, value)}");
    expect(source).toContain("<SelectTrigger");
    expect(source).toContain("Move ${club.label} to bag section");
    expect(source).toContain('size="icon"');
    expect(source).toContain('type="button"');
    expect(source).toContain("min-h-11");
    expect(source).toContain("initializeBagOrder(clubs)");
    expect(source).toContain("moveBagClubWithinSection(current, clubId, direction)");
    expect(source).toContain("moveBagClub(current, clubId, section)");
    expect(source).not.toContain("IconButton");
    expect(source).not.toMatch(/<button\b/);
  });

  it("uses theme tokens for ordinary bag-order surfaces", () => {
    expect(source).toContain("bg-gradient-to-br from-card to-muted/40");
    expect(source).toContain("hover:border-primary/50");
    expect(source).not.toMatch(
      /(?:bg|text|border|hover:bg|hover:border)-(?:white|slate|emerald)-\d*|bg-\[#[0-9A-Fa-f]+\]/,
    );
  });
});
