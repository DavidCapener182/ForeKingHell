import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/data-chat/page.tsx"), "utf8");
const panelSource = readFileSync(
  join(process.cwd(), "src/app/data-chat/data-chat-panel.tsx"),
  "utf8",
);

describe("data chat desktop workbench", () => {
  it("uses the data chat artwork variant in the desktop header", () => {
    expect(pageSource).toContain('variant="dataChat"');
    expect(pageSource).toContain("visual={<PageArtwork");
    expect(pageSource).toContain("min-h-36");
  });

  it("keeps the contextual AI data rail on the desktop route", () => {
    expect(pageSource).toContain("DesktopInsightRail");
    expect(pageSource).toContain('title="AI data rail"');
    expect(pageSource).toContain('scope="data-chat"');
    expect(pageSource).toContain("savedAnswerWorkbench");
    expect(pageSource).toContain("normalizePrompt");
  });

  it("keeps saved answers as an exportable desktop table", () => {
    expect(panelSource).toContain("DesktopTableWorkbenchControls");
    expect(panelSource).toContain('viewKey="data-chat-saved-answers"');
    expect(panelSource).toContain('scope="data-chat-saved-answers"');
    expect(panelSource).toContain('data-workbench-scope="data-chat-saved-answers"');
    expect(panelSource).toContain('exportTableId="data-chat-saved-answers"');
    expect(panelSource).toContain('data-workbench-export-table="data-chat-saved-answers"');
    expect(panelSource).toContain('mainTableLabel="Saved Data Chat answers table"');
    expect(panelSource).toContain("stickyFirstColumn");
    expect(panelSource).toContain("<TableCaption");
    expect(panelSource).toContain("tabIndex={0}");

    for (const column of ["question", "answer", "confidence", "citations", "saved", "action"]) {
      expect(panelSource).toContain(`data-column="${column}"`);
    }
  });

  it("keeps mobile saved answers on cards instead of the desktop main table", () => {
    expect(panelSource).toContain("SavedAnswerCards");
    expect(panelSource).toContain("SavedAnswersWorkbench");
    expect(panelSource).toContain("savedAnswerWorkbench = false");
  });

  it("keeps a desktop performance report builder with edit, export and share controls", () => {
    expect(panelSource).toContain("function PerformanceReportBuilder");
    expect(panelSource).toContain("data-performance-report-builder");
    expect(panelSource).toContain("Performance report draft");
    expect(panelSource).toContain('aria-label="Editable performance report preview"');
    expect(panelSource).toContain("data-performance-report-preview");
    expect(panelSource).toContain("buildPerformanceReportDraft");
    expect(panelSource).toContain("forekinghell-performance-report.md");
    expect(panelSource).toContain("navigator.clipboard.writeText(draft)");
    expect(panelSource).toContain("navigator.share");
    expect(panelSource).toContain("Report copied.");
    expect(panelSource).toContain("Markdown report exported.");
    expect(panelSource).toContain("No cited records yet.");
  });
});
