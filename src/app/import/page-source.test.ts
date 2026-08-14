import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const entry = readFileSync(join(root, "src/app/(app)/import/page.tsx"), "utf8");
const runtimeEntry = readFileSync(
  join(root, "src/app/(app)/companion-runtime/import/page.tsx"),
  "utf8",
);
const runtimeCsvEntry = readFileSync(
  join(root, "src/app/(app)/companion-runtime/import/csv/page.tsx"),
  "utf8",
);
const proxy = readFileSync(join(root, "proxy.ts"), "utf8");
const companion = readFileSync(
  join(root, "src/app/(app)/import/import-companion-page.tsx"),
  "utf8",
);
const companionCsv = readFileSync(
  join(root, "src/app/(app)/import/import-companion-csv-page.tsx"),
  "utf8",
);
const companionRangeImport = readFileSync(
  join(root, "src/app/import/companion-range-import.tsx"),
  "utf8",
);
const companionSyncStatus = readFileSync(
  join(root, "src/components/app/companion-sync-status.tsx"),
  "utf8",
);
const workbench = readFileSync(
  join(root, "src/app/(app)/import/import-workbench-page.tsx"),
  "utf8",
);
const importForm = readFileSync(join(root, "src/app/import/import-form.tsx"), "utf8");
const uploadDropzone = readFileSync(join(root, "src/app/import/upload-dropzone.tsx"), "utf8");
const columnMapping = readFileSync(join(root, "src/app/import/column-mapping-panel.tsx"), "utf8");
const courseOverlay = readFileSync(join(root, "src/app/import/course-overlay.tsx"), "utf8");
const scorecardExtraction = readFileSync(
  join(root, "src/app/import/scorecard-extraction-panel.tsx"),
  "utf8",
);
const saveChecklist = readFileSync(join(root, "src/app/import/save-checklist-card.tsx"), "utf8");
const sessionSettings = readFileSync(join(root, "src/app/import/session-settings.tsx"), "utf8");
const shotPreview = readFileSync(join(root, "src/app/import/shot-preview.tsx"), "utf8");
const featurePanels = readFileSync(
  join(root, "src/components/features/feature-panels.tsx"),
  "utf8",
);
const importStepper = readFileSync(join(root, "src/app/import/import-stepper.tsx"), "utf8");

describe("surface-specific import centre", () => {
  it("rewrites the companion to an isolated compiled route before loading clients", () => {
    expect(proxy).toContain('pathname === "/import"');
    expect(proxy).toContain('return "/companion-runtime/import"');
    expect(proxy).toContain('importSource === "csv"');
    expect(proxy).toContain('return "/companion-runtime/import/csv"');
    expect(runtimeEntry).toContain('from "../../import/import-companion-page"');
    expect(runtimeCsvEntry).toContain('from "../../../import/import-companion-csv-page"');
    expect(entry).toContain('from "./import-workbench-page"');
    expect(entry).not.toContain("getFeatureIdeasData");
    expect(runtimeEntry).not.toContain("import-workbench-page");
    expect(runtimeEntry).not.toContain("import-companion-csv-page");
    expect(companion).not.toContain("CompanionRangeImport");
    expect(companionCsv).toContain("CompanionRangeImport");
  });

  it("keeps the phone source decision short and action-first", () => {
    expect(companion).toContain("Rapsodo R-Cloud");
    expect(companion).toContain("Choose CSV from Files");
    expect(companion).toContain("Add a manual round");
    expect(companion).toContain("Connection status");
    expect(companion).toContain("Recent imports");
    expect(companion).toContain("CompanionSyncStatus");
    expect(companion).toContain("<Alert>");
    expect(companion).toContain("<Card");
    expect(companion).toContain("Connection status · R-Cloud");
    expect(companion).toContain("data-import-other-actions");
    expect(companion).toContain("ImportActionItem");
    expect(companion).toContain("Local import storage");
    expect(companion).toContain("{recent.length > 0 ? (");
    expect(companion).toContain('href="/settings?section=offline#offline-storage"');
    expect(companion).not.toContain("IOSGroupedList");
    expect(companion).not.toContain("IOSListRow");
    expect(companion).not.toContain("getFeatureIdeasData");
    expect(companion).not.toContain("MobileImportFirstRun");
    expect(companionSyncStatus).toContain("<Alert");
    expect(companionSyncStatus).toContain("<Progress");
    expect(companionSyncStatus).toContain("Retry sync");
  });

  it("runs duplicate detection once per stable CSV instead of once per parsed object render", () => {
    expect(companionRangeImport).toContain("const rawCsvText = file?.rawCsvText ?? null");
    expect(companionRangeImport).toContain('fetch("/api/imports/duplicate-check"');
    expect(companionRangeImport).toContain("}, [rawCsvText]);");
  });

  it("uses a compact five-step import flow and only asks for uncertain mappings", () => {
    expect(companionRangeImport).toContain("OperationStepper");
    expect(companionRangeImport).toContain('id: "file"');
    expect(companionRangeImport).toContain('id: "validate"');
    expect(companionRangeImport).toContain('id: "mapping"');
    expect(companionRangeImport).toContain('id: "save"');
    expect(companionRangeImport).toContain('id: "review"');
    expect(companionRangeImport).toContain("data-uncertain-club-mappings");
    expect(companionRangeImport).toContain("Correct matches were skipped");
    expect(companionRangeImport).toContain("data-validation-alert");
    expect(companionRangeImport).toContain("data-import-sticky-footer");
    expect(companionRangeImport).toContain("OperationStatus");
    expect(companionRangeImport).toContain("<Card");
    expect(companionRangeImport).toContain("<Input");
    expect(companionRangeImport).toContain("<Table");
    expect(companionRangeImport).toContain("<Field");
    expect(companionRangeImport).toContain("<Badge");
    expect(companionRangeImport).toContain('<Card\n        size="sm"\n        className="sticky');
    expect(companionRangeImport).toContain('<ButtonGroup className="w-full">');
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
    expect(workbench).toContain("<DesktopWorkflowLayout");
    expect(workbench).toContain("steps={importWorkflowSteps}");
    expect(workbench).not.toContain("<OperationStepper");
    expect(workbench).toContain('id="csv-import"');
    expect(workbench).toContain('href: "/rapsodo"');
    expect(workbench).toContain('href="/rapsodo"');
    expect(workbench).not.toContain("#rapsodo-connect");
    expect(workbench).not.toContain("#rapsodo-import");
    expect(workbench).toContain("<ImportForm");
    expect(workbench).not.toContain('presentation="workbench"');
    expect(uploadDropzone).toContain("data-import-upload-table");
    expect(uploadDropzone).toContain("<Table");
  });

  it("keeps ImportForm workbench-only after the companion runtime split", () => {
    expect(importForm).toContain("CSV import workspace");
    expect(importForm).toContain("<OperationStatus");
    expect(importForm).toContain('status="working"');
    expect(importForm).not.toMatch(/saveState\.status !== "idle" \? \(\s*<Alert/);
    expect(importForm).toContain("<UploadDropzone");
    expect(importForm).toContain("<SaveChecklistCard");
    expect(importForm).toContain("<ShotPreview");
    expect(importForm).toContain("data-import-configuration");
    expect(importForm).toContain('<div className="grid gap-5 xl:grid-cols-2">');
    expect(importForm).not.toMatch(
      /<Card[^>]*>[\s\S]{0,900}<UploadDropzone[\s\S]{0,1500}<SessionSettings/,
    );
    expect(importForm).not.toContain("presentation");
    expect(importForm).not.toContain("MobileImport");
    expect(importForm).not.toContain("MobileBentoSummary");
    expect(importForm).not.toContain("MobileCompactPageHeader");
    expect(importForm).not.toContain("StickyMobileAction");
    expect(importForm).not.toContain("ImportFlowGuide");
    expect(importForm).not.toContain("MetricCard");
    expect(importForm).not.toContain("premium-hero");
    expect(importForm).not.toContain("data-import-presentation");
    expect(importForm).not.toContain("sm:hidden");
    expect(importForm).not.toContain("hidden sm:");
    expect(importForm).not.toMatch(/<button\b/);
    expect(companion).not.toContain("ImportForm");
    expect(companion).not.toContain("CompanionRangeImport");
    expect(companionCsv).toContain("CompanionRangeImport");
  });

  it("uses one workflow stepper and discloses import-quality evidence", () => {
    const firstRun =
      workbench.match(
        /function FirstRunRapsodoOnboarding[\s\S]*?async function getImportLibrary/,
      )?.[0] ?? "";
    const quality =
      featurePanels.match(
        /export function ImportQualityFeaturePanel[\s\S]*?export function DataHealthFeaturePanel/,
      )?.[0] ?? "";

    expect(firstRun).toContain("<Alert");
    expect(firstRun).toContain("data-import-first-run-alert");
    expect(firstRun).not.toContain("const steps =");
    expect(firstRun).not.toContain("<Card");
    expect(quality).toContain("<Alert");
    expect(quality).toContain("<ConnectedMetricBar");
    expect(quality).toContain("<Collapsible");
    expect(quality).toContain("className={buttonVariants");
    expect(quality).not.toContain("<CollapsibleTrigger asChild>");
    expect(quality).toContain("data-import-quality-evidence");
    expect(quality).not.toContain("<DataPanel");
  });

  it("keeps ordinary import surfaces semantic while preserving the course plot palette", () => {
    const fixedPalette =
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#|rgba\(|#[0-9a-f]{3,8}/i;
    const courseOverlayOrdinary = courseOverlay
      .replace(/<svg[\s\S]*?<\/svg>/g, "")
      .replace(/function categoryColour[\s\S]*?function formatMetric/, "function formatMetric");

    for (const ordinarySource of [
      workbench,
      importForm,
      uploadDropzone,
      columnMapping,
      scorecardExtraction,
      saveChecklist,
      sessionSettings,
      shotPreview,
      importStepper,
      courseOverlayOrdinary,
    ]) {
      expect(ordinarySource).not.toMatch(fixedPalette);
    }

    expect(courseOverlay).toContain("bg-[#f4f7f2]");
    expect(courseOverlay).toContain('return "#0284c7"');
    expect(courseOverlay).toContain("var(--status-warning-surface)");
  });
});
