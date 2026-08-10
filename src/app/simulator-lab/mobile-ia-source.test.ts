import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/simulator-lab/page.tsx"), "utf8");

function componentBody(name: string, nextName: string) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("Performance Lab native mobile information architecture", () => {
  it("puts the estimate and next practice decision ahead of supporting evidence", () => {
    const mobile = componentBody("MobilePerformanceLab", "MobileCostlyShotRows");

    expect(mobile.indexOf("Launch monitor handicap")).toBeLessThan(mobile.indexOf("Do this next"));
    expect(mobile.indexOf("Do this next")).toBeLessThan(mobile.indexOf("Evidence and tools"));
    expect(mobile).toContain("expectedRangeLabel");
    expect(mobile).toContain("Open practice planner");
    expect(mobile).toContain('label="Performance Lab evidence and tools"');
  });

  it("keeps specialist tools one disclosure level deep and replaces phone tables with rows", () => {
    const mobile = componentBody("MobilePerformanceLab", "MobileCostlyShotRows");

    for (const section of [
      "Biggest leaks",
      "Shot pattern map",
      "Bag gaps",
      "Latest session and setup",
      "What if?",
      "Handicap trend and method",
    ]) {
      expect(mobile).toContain(section);
    }

    expect(mobile).toContain("<FlightLineMap");
    expect(mobile).toContain("mobile");
    expect(mobile).not.toContain("<Table");
    expect(source).toContain("SessionDeltaTable");
    expect(source).toContain("EquipmentImpactTable");
    expect(source).toContain('className="hidden lg:grid"');
  });

  it("moves the dense shot filter into a labelled mobile sheet", () => {
    const map = componentBody("FlightLineMap", "CorridorSplit");

    expect(map).toContain("MobileFilterSheet");
    expect(map).toContain("Shot filter ·");
    expect(map).toContain("filterOptions");
    expect(source).toContain('aria-current={active ? "page" : undefined}');
  });
});
