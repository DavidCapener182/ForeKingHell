import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("analysis workspace source contract", () => {
  it("keeps the four missing analysis foundations in one secondary workspace", () => {
    const page = source("src/app/(app)/analyse/workspace/page.tsx");

    expect(page).toContain("Data-quality inbox");
    expect(page).toContain("Analysis notes");
    expect(page).toContain("Equipment change analysis");
    expect(page).toContain("Analysis snapshots");
    expect(page).toContain("Every issue has a direct repair path");
    expect(page).toContain("Results remain");
    expect(page).toContain("observational and do not prove causation");
    for (const metric of [
      "Carry",
      "Ball speed",
      "Launch",
      "Spin",
      "Offline",
      "Repeatability",
      "Strike",
    ]) {
      expect(page).toContain(`label="${metric}"`);
    }
    expect(source("src/lib/equipment-change-analysis.ts")).toContain("does not prove");
  });

  it("derives owner identity server-side for every mutation", () => {
    const actions = source("src/app/analyse/workspace/actions.ts");

    expect(actions.match(/requireCurrentUserId\(\)/g)?.length).toBe(4);
    expect(actions).toContain("eq(sessions.userId, userId)");
    expect(actions).toContain("eq(analysisAnnotations.userId, userId)");
    expect(actions).toContain("eq(analysisSnapshots.userId, userId)");
    expect(actions).not.toContain('formData.get("userId")');
  });

  it("adds owner-only RLS and cross-owner session protection", () => {
    const migration = source("drizzle/0041_analysis_workspace.sql");

    expect(migration).toContain("fkh_analysis_annotations_owner_all");
    expect(migration).toContain("fkh_analysis_snapshots_owner_all");
    expect(migration).toContain("user_id = (SELECT auth.uid())");
    expect(migration).toContain("fkh_validate_analysis_annotation_scope");
    expect(migration).toContain("session_row.user_id = NEW.user_id");
    expect(migration).toContain("fkh_reject_scope_reassignment('user_id')");
    expect(migration).toContain("REVOKE ALL PRIVILEGES");
  });

  it("does not fetch a 2,000-row equipment sample when no equipment change exists", () => {
    const page = source("src/app/(app)/analyse/workspace/page.tsx");

    expect(page).toContain("const equipmentShotRows = equipmentRows.length");
    expect(page).toContain(".limit(2_000)");
    expect(page).toContain(": [];");
  });
});
