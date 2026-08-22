import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/practice/practice-planner-client.tsx"),
  "utf8",
);

describe("practice planner desktop ledger", () => {
  it("keeps the workbench client free of the dedicated companion stack", () => {
    for (const obsoleteSurface of [
      "ActiveRangeMode",
      "PracticeFinishedActions",
      "PracticeMobileTask",
      "PracticeMobileBlockPicker",
      "PracticeMobileWhy",
      "PracticeMobileResult",
      "IOSGroupedList",
      "IOSDisclosureGroup",
      "IOSInlineStatus",
      "IOSListRow",
      "IOSSectionHeader",
      "MobileFilterSheet",
      "CarouselContent",
      "activePracticeStorageKey",
      "cacheActivePractice",
      "readActivePractice",
      "clearActivePractice",
      "navigator.wakeLock",
      "data-active-range-mode",
      "data-practice-mobile-task",
    ]) {
      expect(source).not.toContain(obsoleteSurface);
    }

    expect(source).not.toContain("accountId:");
    expect(source).toContain("<PracticeSetupBar");
    expect(source).toContain("<PracticeAgenda");
    expect(source).toContain("<SelectedBlockDetail");
    expect(source).toContain("<SessionControlPanel");
    expect(source).toContain("<PlanVsActual");
    expect(source).toContain("<PracticeBlockLedger");
    expect(source).toContain("<PracticeLibrary");
    expect(source).toContain("await startPracticePlanAction(savedPlanId)");
    expect(source).toContain(
      "Practice started. Upload or sync the matching launch-monitor session when finished.",
    );
  });

  it("keeps practice blocks as an exportable desktop table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="practice-blocks"');
    expect(source).toContain('scope="practice-blocks"');
    expect(source).toContain('data-workbench-scope="practice-blocks"');
    expect(source).toContain('exportTableId="practice-blocks"');
    expect(source).toContain('data-workbench-export-table="practice-blocks"');
    expect(source).toContain('mainTableLabel="Practice block ledger table"');
    expect(source).toContain('mainTableLabel="Practice block ledger table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "block",
      "type",
      "club",
      "planned-volume",
      "target",
      "upload-status",
      "evidence",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps practice as a workflow page without a contextual AI rail", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("commonAiPrompts");
    expect(source).not.toContain("rail={");
  });

  it("keeps generated practice blocks editable before upload scoring", () => {
    expect(source).toContain("PracticeBlockEditControls");
    expect(source).toContain("PracticePlanImageDialog");
    expect(source).toContain("onBallCountChange");
    expect(source).toContain("onSwapDrill");
    expect(source).toContain("onSuggestDrill");
    expect(source).toContain("practicePlanWithEditedBlocks");
    expect(source).toContain("drillOptionsByBlock");
    expect(source).toContain("buildPracticeDrillOptionsByBlock");
    expect(source).toContain("originalPracticeDrillOption");
    expect(source).toContain("Original agenda -");
    expect(source).toContain("...buildPracticeDrillAlternatives(block).slice(0, 3)");
    expect(source).toContain("selectedPracticeDrillOptionId");
    expect(source).toContain("buildUniversalPracticeDrillAlternatives");
    expect(source).toContain("const mixedAlternatives");
    expect(source).toContain("return retargetPracticeBlock(nextBlock, ballCount)");
    expect(source).toContain("updatePracticeBlockBallsWithinTotal");
    expect(source).toContain("redistributePracticeBalls");
    expect(source).toContain("current.totalBalls ?? totalBallsForBlocks(current.blocks)");
    expect(source).toContain("Practice volume rebalanced. Save the edited plan before upload.");
    expect(source).toContain("setSavedImageDialogOpen(true)");
    expect(source).toContain("savedImagePreviewUrl");
    expect(source).toContain("openSavedImageDialog(true)");
    expect(source).toContain("onShowPracticeImage");
    expect(source).toContain("onPngPreviewChange");
    expect(source).toContain("pngPreviewUrl");
    expect(source).toContain("grid-rows-[auto_minmax(0,1fr)_auto]");
    expect(source).toContain("lg:grid-cols-[minmax(24rem,0.9fr)_minmax(30rem,1.1fr)]");
    expect(source).toContain("min-h-0 overflow-y-auto bg-muted p-3 lg:bg-background");
    expect(source).toContain(
      "min-h-0 overflow-y-auto border-t bg-muted p-3 lg:border-l lg:border-t-0",
    );
    expect(source).toContain("practicePlanImageDataUrl(plan)");
    expect(source).toContain("downloadPracticePlanImage");
    expect(source).toContain("Saved practice reference PNG preview");
    expect(source).toContain("Show PNG");
    expect(source).toContain("Save as image");
    expect(source).toContain("setOutcome(successOutcome(messageText))");
    expect(source).toContain("setSavedPlanId(null)");
    expect(source).toContain("setComparison(null)");
    expect(source).toContain("setPracticeScore(null)");
    expect(source).toContain("Practice drill swapped. Save the edited plan before upload.");
    expect(source).toContain("<ResponsiveDetailPanel");
    expect(source).toContain("blockSheetOpen");
    expect(source).toContain("Edit block");
    expect(source).toContain("<Drawer");
    expect(source).toContain("Templates &amp; saved plans");
    const selectedBlockPanel =
      source.match(
        /<ResponsiveDetailPanel[\s\S]*?data-selected-block-sheet-content[\s\S]*?<\/ResponsiveDetailPanel>/,
      )?.[0] ?? "";
    expect(selectedBlockPanel).toContain("data-selected-block-sheet-content");
    expect(selectedBlockPanel).not.toContain("<Card");
    const planVsActual =
      source.match(/function PlanVsActual[\s\S]*?function PracticeLibrary/)?.[0] ?? "";
    expect(planVsActual).toContain("data-practice-result={outcome.status}");
    expect(planVsActual).toContain("Practice result");
    expect(planVsActual).toContain("summarizePracticeOutcome");
    expect(planVsActual).toContain("practiceDecisionResultLabel");
    expect(planVsActual).toContain("<Card");
    expect(planVsActual).toContain("Planned target");
    expect(planVsActual).toContain("Measured actual");
    expect(planVsActual).toContain("Block that mattered most");
    expect(planVsActual).toContain("Next Practice");
  });

  it("uses shadcn Buttons for template and saved-plan choices", () => {
    const templates =
      source.match(/function TemplatesPanel[\s\S]*?function SavedPlansPanel/)?.[0] ?? "";
    const savedPlans =
      source.match(/function SavedPlansPanel[\s\S]*?function CompactSelect/)?.[0] ?? "";

    for (const library of [templates, savedPlans]) {
      expect(library).toContain("<Button");
      expect(library).toContain('variant="outline"');
      expect(library).not.toMatch(/<button\b/);
    }
  });

  it("keeps the saved-reference dialog keyboard, dynamic-viewport and dark-mode safe", () => {
    const dialogSource = source.slice(
      source.indexOf("function PracticePlanImageDialog"),
      source.indexOf("function PracticeBlockLedger"),
    );

    expect(dialogSource).toContain("100dvh");
    expect(dialogSource).toContain("env(safe-area-inset-bottom)");
    expect(dialogSource).toContain("bg-card");
    expect(dialogSource).not.toContain("100vh");
    expect(dialogSource).not.toContain("max-lg:bg-white");
    expect(dialogSource).toContain("lg:border-primary-foreground/20");
    expect(dialogSource).not.toMatch(
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#/,
    );
    expect(source).toContain('context.fillStyle = "#f6f4e7"');
  });

  it("transforms the centre programme into measured plan versus actual", () => {
    const agenda = source.match(/function PracticeAgenda[\s\S]*?function ProgrammeFact/)?.[0] ?? "";
    const result = source.match(/function PlanVsActual[\s\S]*?function PracticeLibrary/)?.[0] ?? "";

    expect(agenda).toContain("hasEvidence");
    expect(agenda).toContain(
      "<PlanVsActual comparison={comparison} blocks={blocks} score={score} />",
    );
    expect(result).toContain("data-plan-vs-actual");
    expect(result).toContain("decision.target");
    expect(result).toContain("decision.actual");
    expect(result).toContain("practiceDecisionResultLabel(decision)");
    expect(result).toContain("practiceComparisonCardTone(decision.result)");
    expect(result).toContain('decision.result === "failed"');
  });

  it("keeps validation failures and successful outcomes distinct inside the Today card", () => {
    const linkSession =
      source.match(/function linkSelectedSession[\s\S]*?function startPractice/)?.[0] ?? "";
    const todayCard =
      source.match(/function PracticeTodayCard[\s\S]*?function formatSessionOptionType/)?.[0] ?? "";

    expect(source).toContain('status: "error" | "success"');
    expect(source).toContain("setOutcome(successOutcome(messageText))");
    expect(source).toContain(
      "<PracticeTodayCard plan={plan} focusSummary={focusSummary} outcome={outcome} />",
    );
    expect(linkSession).toContain('errorOutcome("Choose an uploaded session first.")');
    expect(linkSession).toContain(
      'errorOutcome("Save this practice plan before importing a session into it.")',
    );
    expect(linkSession).toContain(
      'result.error ?? "That uploaded session could not be scored against this plan."',
    );
    expect(linkSession).toContain("successOutcome(");
    expect(todayCard).toContain("<Alert");
    expect(todayCard).toContain('variant={outcome.status === "error" ? "destructive" : "default"}');
    expect(todayCard).toContain('role={outcome.status === "error" ? "alert" : "status"}');
    expect(todayCard).toContain("var(--status-success-border)");
    expect(todayCard).toContain("var(--status-success-surface)");
    expect(todayCard).toContain("var(--status-success-foreground)");
    expect(todayCard).toContain("data-practice-outcome={outcome.status}");
    expect(todayCard).not.toContain("border-primary/20 bg-primary/5");
    expect(source).not.toContain("const [message, setMessage]");
  });

  it("keeps the connected programme readable across semantic themes", () => {
    const agenda =
      source.match(/function PracticeAgenda[\s\S]*?function SelectedBlockDetail/)?.[0] ?? "";

    expect(agenda).toContain("before:bg-gradient-to-b");
    expect(agenda).toContain('selected && "border-primary bg-primary text-primary-foreground"');
    expect(agenda).toContain("data-practice-programme-block");
    expect(agenda).not.toMatch(
      /(?:bg|text|border)-(?:white|black|slate|emerald|green|amber|red)(?:-|\b)/,
    );
  });

  it("uses the premium three-zone workspace and the requested drawers and sticky action", () => {
    expect(source).toContain("data-practice-training-workspace");
    expect(source).toContain("data-practice-session-brief");
    expect(source).toContain("data-practice-agenda");
    expect(source).toContain("data-practice-context");
    expect(source).toContain(
      "xl:grid-cols-[minmax(15rem,0.72fr)_minmax(34rem,1.8fr)_minmax(17rem,0.78fr)]",
    );
    expect(source).toContain("Save &amp; Start Practice");
    expect(source).toContain("PracticeEvidenceLedgerDrawer");
    expect(source).toContain("PracticeLibrary");
    expect(source).toContain("<ToggleGroup");
  });
});
