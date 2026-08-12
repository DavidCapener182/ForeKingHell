import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const entry = readFileSync(join(root, "src/app/(app)/import/page.tsx"), "utf8");
const runtimeEntry = readFileSync(
  join(root, "src/app/(app)/companion-runtime/import/page.tsx"),
  "utf8",
);
const proxy = readFileSync(join(root, "proxy.ts"), "utf8");
const companion = readFileSync(
  join(root, "src/app/(app)/import/import-companion-page.tsx"),
  "utf8",
);
const companionRangeImport = readFileSync(
  join(root, "src/app/import/companion-range-import.tsx"),
  "utf8",
);
const workbench = readFileSync(
  join(root, "src/app/(app)/import/import-workbench-page.tsx"),
  "utf8",
);

describe("surface-specific import centre", () => {
  it("rewrites the companion to an isolated compiled route before loading clients", () => {
    expect(proxy).toContain('pathname === "/import"');
    expect(proxy).toContain('return "/companion-runtime/import"');
    expect(runtimeEntry).toContain('from "../../import/import-companion-page"');
    expect(entry).toContain('from "./import-workbench-page"');
    expect(entry).not.toContain("getFeatureIdeasData");
    expect(runtimeEntry).not.toContain("import-workbench-page");
  });

  it("keeps the phone source decision short and action-first", () => {
    expect(companion).toContain("Rapsodo R-Cloud");
    expect(companion).toContain("Choose CSV from Files");
    expect(companion).toContain("Add a manual round");
    expect(companion).toContain("Connection status");
    expect(companion).toContain("Recent imports");
    expect(companion).toContain("CompanionSyncStatus");
    expect(companion).not.toContain("getFeatureIdeasData");
    expect(companion).not.toContain("MobileImportFirstRun");
  });

  it("runs duplicate detection once per stable CSV instead of once per parsed object render", () => {
    expect(companionRangeImport).toContain("const rawCsvText = file?.rawCsvText ?? null");
    expect(companionRangeImport).toContain('fetch("/api/imports/duplicate-check"');
    expect(companionRangeImport).toContain("}, [rawCsvText]);");
  });

  it("preserves the exportable configurable workbench library", () => {
    expect(workbench).toContain("DesktopWorkflowLayout");
    expect(workbench).toContain("DesktopTableWorkbenchControls");
    expect(workbench).toContain('viewKey="import-library"');
    expect(workbench).toContain('exportTableId="import-library"');
    expect(workbench).toContain('data-workbench-export-table="import-library"');
    expect(workbench).toContain('mainTableLabel="Import file library table"');
    expect(workbench).toContain("ConfirmSubmitButton");
    expect(workbench).toContain('confirmActionLabel="Archive file"');
  });
});
