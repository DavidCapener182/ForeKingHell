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
    expect(source).toContain("moveToSection(club.id, event.target.value)");
    expect(source).toContain("Move ${club.label} to bag section");
    expect(source).toContain('className="grid size-11');
    expect(source).toContain('type="button"');
    expect(source).toContain("min-h-11");
    expect(source).toContain("initializeBagOrder(clubs)");
    expect(source).toContain("moveBagClubWithinSection(current, clubId, direction)");
    expect(source).toContain("moveBagClub(current, clubId, section)");
  });
});
