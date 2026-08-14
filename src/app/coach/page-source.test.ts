import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = readFileSync(join(root, "src/app/(app)/coach/page.tsx"), "utf8");
const workbenchSource = readFileSync(
  join(root, "src/components/app/ai-desktop-workbench.tsx"),
  "utf8",
);
const dataChatSource = readFileSync(join(root, "src/app/data-chat/data-chat-panel.tsx"), "utf8");
const lazyDataChatSource = readFileSync(
  join(root, "src/app/coach/lazy-coach-data-chat-panel.tsx"),
  "utf8",
);

describe("professional Coach workspace", () => {
  it("keeps one dominant diagnosis with the complete coaching read", () => {
    expect(source).toContain("Your biggest scoring opportunity is…");
    expect(source).toContain("data-primary-diagnosis");
    expect(source).toContain('label="What I see"');
    expect(source).toContain('label="Why it matters"');
    expect(source).toContain('label="Confidence"');
    expect(source).toContain('label="Next action"');
    expect(source).toContain("confidenceDetail(topClub)");
    expect(source).toContain("whyItMatters(topClub)");
  });

  it("shows only the three requested supporting evidence views", () => {
    expect(source).toContain("<DispersionVisual");
    expect(source).toContain("<CarryConsistencyVisual");
    expect(source).toContain("<RoundResultVisual");
    expect(source).toContain("Three signals behind the read");
    expect(source).not.toContain("CoachSupportingEvidencePanel");
    expect(source).not.toContain("CoachPracticeFeaturePanel");
    expect(source).not.toContain("CoachSocialPrompt");
  });

  it("moves primary, secondary and improving work directly into Practice", () => {
    expect(source).toContain('label="Primary issue"');
    expect(source).toContain('label="Secondary issue"');
    expect(source).toContain('label="What is improving"');
    expect(source).toContain('practiceHref("latest_weakness")');
    expect(source).toContain('practiceHref("confidence")');
    expect(source).toContain('practiceHref("scoring")');
    expect(source).toContain("Open in Practice");
  });

  it("uses an evidence browser for sessions, clubs, rounds, confidence and source records", () => {
    expect(source).toContain("data-coach-evidence-browser");
    for (const label of ["Sessions", "Clubs", "Rounds", "Confidence", "Source records"]) {
      expect(source).toContain(`label="${label}"`);
    }
    expect(source).toContain('href="/sessions"');
    expect(source).toContain('href="/bag"');
    expect(source).toContain('href="/rounds"');
    expect(source).toContain('href="/coach/diagnosis"');
    expect(source).toContain('href="/shots"');
  });

  it("embeds Data Chat as a standalone resizable conversation and evidence workspace", () => {
    expect(source).toContain("<LazyCoachDataChatPanel");
    expect(source).toContain("askStandalone");
    expect(lazyDataChatSource).toContain('import("@/app/data-chat/data-chat-panel")');
    expect(lazyDataChatSource).toContain('questionId="coach-data-chat-question"');
    expect(workbenchSource).toContain("askStandalone = false");
    expect(workbenchSource).toContain(
      '<ResizablePanel defaultSize="72" minSize="58" maxSize="80">',
    );
    expect(workbenchSource).toContain(
      '<ResizablePanel defaultSize="28" minSize="20" maxSize="42">',
    );
    expect(dataChatSource).toContain("<ResizablePanelGroup");
    expect(dataChatSource).toContain("<ResizableHandle withHandle");
    expect(dataChatSource).toContain('aria-label="Data Chat conversation"');
    expect(dataChatSource).toContain('aria-label="Evidence context"');
    expect(dataChatSource).toContain('className="rounded-none border-y bg-transparent p-0"');
  });

  it("keeps phone Coach to diagnosis, why and one practice action", () => {
    const start = source.indexOf("function MobileCoachSummary");
    const end = source.indexOf("function CoachEmptyState", start);
    const mobile = source.slice(start, end);

    expect(source).toContain('surface === "companion"');
    expect(mobile).toContain("Main diagnosis");
    expect(mobile).toContain("Why");
    expect(mobile).toContain("Build practice plan");
    expect(mobile).not.toContain("MobileCompanionAccordion");
    expect(mobile).not.toContain("Evidence browser");
    expect(mobile).not.toContain("Data Chat");
  });

  it("preserves the full-width app layout contract", () => {
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
  });
});
