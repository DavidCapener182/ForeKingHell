import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/admin/moderation/page.tsx"), "utf8");
const bulkSubmitSource = readFileSync(
  join(process.cwd(), "src/app/admin/admin-bulk-action-submit.tsx"),
  "utf8",
);

describe("admin moderation desktop console source", () => {
  it("uses a shared admin moderation workbench without adding a contextual AI rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="admin-moderation">');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps reports and events as separate exportable queue workbenches", () => {
    for (const scope of ["admin-moderation-reports", "admin-moderation-events"]) {
      expect(source).toContain(`data-workbench-scope="${scope}"`);
      expect(source).toContain(`viewKey="${scope}"`);
      expect(source).toContain(`scope="${scope}"`);
      expect(source).toContain(`exportTableId="${scope}"`);
      expect(source).toContain(`data-workbench-export-table="${scope}"`);
    }

    expect(source).toContain('aria-label="User reports table"');
    expect(source).toContain('aria-label="Moderation events table"');
    expect(source).toContain("<caption");
    expect(source).toContain("tabIndex={0}");
  });

  it("keeps moderation bulk and row actions confirmable", () => {
    expect(source).toContain("bulkResolveSocialReportsAction");
    expect(source).toContain("bulkResolveModerationEventsAction");
    expect(source).toContain("AdminBulkActionSubmit");
    expect(source).toContain("AdminConfirmSubmitButton");
    expect(source).toContain("writes an admin audit entry");
  });

  it("announces selected bulk rows and blocks empty bulk submits", () => {
    expect(source).toContain('formId="admin-report-bulk-form"');
    expect(source).toContain('fieldName="reportId"');
    expect(source).toContain('formId="admin-event-bulk-form"');
    expect(source).toContain('fieldName="eventId"');

    expect(bulkSubmitSource).toContain("document.querySelectorAll<HTMLInputElement>");
    expect(bulkSubmitSource).toContain('data-admin-bulk-selected-count="true"');
    expect(bulkSubmitSource).toContain('aria-live="polite"');
    expect(bulkSubmitSource).toContain("disabled={selectedCount === 0}");
    expect(bulkSubmitSource).toContain("Resolve ${selectedCount} selected");
  });
});
