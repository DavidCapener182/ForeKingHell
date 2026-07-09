import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/import/page.tsx"), "utf8");

describe("import desktop file library", () => {
  it("uses the desktop workflow template for the import centre", () => {
    expect(source).toContain("DesktopWorkflowLayout");
    expect(source).toContain("importWorkflowHelpItems");
    expect(source).toContain("buildImportWorkflowSteps");
    expect(source).toContain('helpTitle="Import centre help"');
    expect(source).toContain('helpDescription="Keep launch-monitor data trustworthy"');
    expect(source).toContain("Choose source");
    expect(source).toContain("Upload and map");
    expect(source).toContain("Review rows");
    expect(source).toContain("Save import");
    expect(source).toContain("Use evidence");
    expect(source).toContain("Rapsodo first");
    expect(source).toContain("Trust before action");
    expect(source).toContain("Proof stays secondary");
    expect(source).not.toContain("DesktopWorkbenchLayout");
  });

  it("keeps the import library table exportable and configurable", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="import-library"');
    expect(source).toContain('scope="import"');
    expect(source).toContain('exportTableId="import-library"');
    expect(source).toContain('data-workbench-scope="import"');
    expect(source).toContain('data-workbench-export-table="import-library"');
    expect(source).toContain('mainTableLabel="Import file library table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");
    expect(source).toContain("sticky left-0 z-20");
    expect(source).toContain("ConfirmSubmitButton");
    expect(source).toContain('confirmTitle="Archive import file"');
    expect(source).toContain("confirmMessage={`Archive ${file.fileName}?");
    expect(source).toContain("without deleting linked session evidence");
    expect(source).toContain('confirmActionLabel="Archive file"');

    for (const column of ["file", "status", "session", "parse", "actions"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
