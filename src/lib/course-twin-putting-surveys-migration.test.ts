import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "drizzle/0052_course_twin_putting_surveys.sql"),
  "utf8",
);

describe("Course Twin putting survey migration", () => {
  it("keeps raw survey grids service-role only under forced RLS", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE public.fkh_course_twin_putting_surveys");
    expect(migration).toContain("TO service_role");
    expect(migration).not.toMatch(/CREATE POLICY/i);
  });

  it("enforces one bounded survey record per hole", () => {
    expect(migration).toContain("hole_number BETWEEN 1 AND 54");
    expect(migration).toContain("grid_spacing_m BETWEEN 0.02 AND 1");
    expect(migration).toContain("vertical_accuracy_mm > 0");
    expect(migration).toMatch(/course_id,\s*hole_number/);
  });
});
