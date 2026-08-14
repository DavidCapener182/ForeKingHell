import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/data-chat/page.tsx"), "utf8");
const panelSource = readFileSync(
  join(process.cwd(), "src/app/data-chat/data-chat-panel.tsx"),
  "utf8",
);

describe("data chat desktop workbench", () => {
  it("uses the shadcn conversation, suggestion, composer and evidence primitives", () => {
    for (const primitive of [
      "<Command",
      "<ScrollArea",
      "<InputGroup",
      "<InputGroupTextarea",
      "<Skeleton",
      "<Alert",
      "<AppEmptyState",
      "<Collapsible",
      "<Item",
      "<ResponsiveDetailPanel",
    ]) {
      expect(panelSource).toContain(primitive);
    }

    const assistantTurn =
      panelSource.match(/function AssistantTurn[\s\S]*?function CitationItem/)?.[0] ?? "";
    expect(assistantTurn).toContain("<CitationItem");
    expect(assistantTurn).not.toContain("IOSDisclosureGroup");
    expect(assistantTurn).not.toContain("IOSGroupedList");
    expect(panelSource).toContain('id="data-chat-composer"');
    expect(panelSource).toContain(
      'href: "/data-chat?prompt=Build%20a%20practice%20plan#data-chat-composer"',
    );
    expect(panelSource).not.toContain("#from-my-data");
  });

  it("uses the data chat artwork variant in the desktop header", () => {
    expect(pageSource).toContain('variant="dataChat"');
    expect(pageSource).toContain('<PageArtwork variant="dataChat"');
    expect(pageSource).toContain("min-h-36");
  });

  it("keeps the contextual AI rail inside the shared resizable workbench", () => {
    expect(pageSource).toContain("AiDesktopWorkbench");
    expect(pageSource).toContain('defaultTab="ask"');
    expect(pageSource).toContain("DesktopInsightRail");
    expect(pageSource).toContain('title="AI data context"');
    expect(pageSource).toContain("ConnectedMetricBar");
    expect(pageSource).toContain("<Alert");
    expect(pageSource).toContain('scope="data-chat"');
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

  it("keeps one desktop saved-answer table and no duplicate card list", () => {
    expect(panelSource).toContain("SavedAnswersWorkbench");
    expect(panelSource).not.toContain("SavedAnswerCards");
    expect(panelSource).not.toContain("savedAnswerWorkbench");
    expect(panelSource).not.toContain("IOSDisclosureGroup");
  });

  it("keeps a desktop performance report builder with edit, export and share controls", () => {
    expect(panelSource).toContain("function PerformanceReportBuilder");
    expect(panelSource).toContain("data-performance-report-builder");
    expect(panelSource).toContain("Performance report draft");
    expect(panelSource).toContain('aria-label="Editable performance report preview"');
    expect(panelSource).toContain("data-performance-report-preview");
    expect(panelSource).toContain("buildPerformanceReportDraft");
    expect(panelSource).toContain("lm-world-tour-performance-report.md");
    expect(panelSource).toContain("navigator.clipboard.writeText(draft)");
    expect(panelSource).toContain("navigator.share");
    expect(panelSource).toContain('role="status"');
    expect(panelSource).toContain('aria-live="polite"');
    expect(panelSource).toContain('aria-atomic="true"');
    expect(panelSource).toContain("Report copied.");
    expect(panelSource).toContain("Markdown report exported.");
    expect(panelSource).toContain("No cited records yet.");
  });
});
