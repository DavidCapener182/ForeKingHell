import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/data-chat/page.tsx"), "utf8");
const panelSource = readFileSync(
  join(process.cwd(), "src/app/data-chat/data-chat-panel.tsx"),
  "utf8",
);

describe("Data Chat analyst experience", () => {
  it("removes the generic dashboard and tab framing", () => {
    expect(pageSource).toContain('scope="data-chat"');
    expect(pageSource).not.toContain("AiDesktopWorkbench");
    expect(pageSource).not.toContain("DesktopInsightRail");
    expect(pageSource).not.toContain("ConnectedMetricBar");
    expect(pageSource).not.toContain("PageArtwork");
    expect(pageSource).not.toContain("PageHeader");
  });

  it("uses the requested empty-state prompt language and Command-style rows", () => {
    expect(panelSource).toContain("What do you want to understand?");
    for (const prompt of [
      "What should I practise?",
      "Which club is least reliable?",
      "What changed recently?",
      "Why did my scoring improve?",
      "Build a 30-minute practice session.",
    ]) {
      expect(panelSource).toContain(prompt);
    }
    expect(panelSource).toContain("<CommandItem");
    expect(panelSource).toContain("rounded-none border-t");
  });

  it("separates every analyst answer into the required reading structure", () => {
    const assistantTurn =
      panelSource.match(/function AssistantTurn[\s\S]*?function AnalystSection/)?.[0] ?? "";

    for (const section of [
      'title="Answer"',
      'title="Evidence"',
      'title="Drills"',
      'title="Next question"',
    ]) {
      expect(assistantTurn).toContain(section);
    }
    expect(assistantTurn).toContain("onSelectCitation(citation)");
    expect(assistantTurn).toContain("Open evidence:");
  });

  it("opens selected citations in the persistent right evidence panel", () => {
    expect(panelSource).toContain("data-evidence-context-panel");
    expect(panelSource).toContain("data-active-evidence");
    expect(panelSource).toContain("setActiveCitationId(citation.id)");
    expect(panelSource).toContain("evidencePanelRef.current?.focus");
    expect(panelSource).toContain("Open source record");
  });

  it("keeps the large composer and quiet credit balance at the bottom", () => {
    expect(panelSource).toContain('id="data-chat-composer"');
    expect(panelSource).toContain("min-h-32");
    expect(panelSource).toContain("credits remaining");
    expect(panelSource).toContain("Ask analyst");
  });

  it("keeps saved answers in a side history sheet only", () => {
    expect(panelSource).toContain("function SavedAnswersHistory");
    expect(panelSource).toContain("Saved answers");
    expect(panelSource).toContain("They stay out of the conversation until you need");
    expect(panelSource).not.toContain("SavedAnswersWorkbench");
    expect(panelSource).not.toContain("PerformanceReportBuilder");
  });
});
