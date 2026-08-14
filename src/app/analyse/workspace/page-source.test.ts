import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("analysis workspace source contract", () => {
  it("keeps one desktop evidence workspace without an obsolete companion tree", () => {
    const page = source("src/app/(app)/analyse/workspace/page.tsx");

    expect(page).toContain("<DataQualityInbox");
    expect(page).toContain("<AnnotationWorkspace");
    expect(page).toContain("<EquipmentImpactWorkspace");
    expect(page).toContain("<SnapshotWorkspace");
    expect(page).not.toContain("MobileAnalysisWorkspace");
    expect(page).not.toContain("BottomSheet");
    expect(page).not.toContain("@/components/app/ios-mobile");
    expect(page).not.toContain("lg:hidden");
    expect(page).not.toContain("hidden lg:");
  });

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

  it("uses the shared shadcn textarea for notes and snapshots", () => {
    const page = source("src/app/(app)/analyse/workspace/page.tsx");

    expect(page).toContain('import { Textarea } from "@/components/ui/textarea"');
    expect(page.match(/<Textarea\b/g)).toHaveLength(2);
    expect(page).not.toMatch(/<textarea\b/);
  });

  it("uses shadcn Field and Input for visible analysis controls", () => {
    const page = source("src/app/(app)/analyse/workspace/page.tsx");
    const visibleInputs = page.match(/<(?:Input|input)\b[^>]*>/g) ?? [];

    expect(page).toContain('import { Field, FieldLabel } from "@/components/ui/field"');
    expect(page).toContain('import { Input } from "@/components/ui/input"');
    expect(page.match(/<Input\b/g)).toHaveLength(7);
    expect(
      visibleInputs
        .filter((input) => input.startsWith("<input"))
        .every((input) => input.includes('type="hidden"')),
    ).toBe(true);
    expect(page).toContain("var(--status-warning-foreground)");
    expect(page).toContain("var(--status-information-foreground)");
    expect(page).not.toContain('severity === "high" ? "bg-red-500"');
  });

  it("renders the migration warning as a semantic shadcn alert", () => {
    const page = source("src/app/(app)/analyse/workspace/page.tsx");
    const migrationWarning =
      page.match(/\{!data\.storageAvailable \? \([\s\S]*?\) : null\}/)?.[0] ?? "";

    expect(page).toContain(
      'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"',
    );
    expect(migrationWarning).toContain(
      "<AlertTitle>Analysis storage migration pending</AlertTitle>",
    );
    expect(migrationWarning).toContain("<AlertDescription>");
    expect(migrationWarning).toContain("var(--status-warning-surface)");
    expect(migrationWarning).not.toContain("border-amber-300");
    expect(migrationWarning).not.toContain("bg-amber-50");
    expect(migrationWarning).not.toContain("text-amber-950");
  });
});
