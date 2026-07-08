import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("course overlay accessibility", () => {
  it("keeps each hole map paired with a chart summary and data table fallback", () => {
    const source = readFileSync(join(process.cwd(), "src/app/import/course-overlay.tsx"), "utf8");

    expect(source).toContain("ChartAccessibleFallback");
    expect(source).toContain("title={`Hole ${hole.holeNumber} overlay`}");
    expect(source).toContain("summary={holeOverlaySummary(hole)}");
    expect(source).toContain("rows={holeOverlayRows(hole)}");
    expect(source).toContain("const holeOverlayColumns");
  });
});
