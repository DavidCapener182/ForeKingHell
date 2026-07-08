import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/practice/practice-planner-client.tsx"),
  "utf8",
);

describe("practice planner desktop ledger", () => {
  it("keeps practice blocks as an exportable desktop table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="practice-blocks"');
    expect(source).toContain('scope="practice-blocks"');
    expect(source).toContain('data-workbench-scope="practice-blocks"');
    expect(source).toContain('exportTableId="practice-blocks"');
    expect(source).toContain('data-workbench-export-table="practice-blocks"');
    expect(source).toContain('mainTableLabel="Practice block ledger table"');
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
    expect(source).toContain("min-h-0 overflow-y-auto bg-[#f8f7ed] p-3");
    expect(source).toContain("min-h-0 overflow-y-auto border-t bg-[#f6f4e7] p-3");
    expect(source).toContain("practicePlanImageDataUrl(plan)");
    expect(source).toContain("downloadPracticePlanImage");
    expect(source).toContain("Saved practice reference PNG preview");
    expect(source).toContain("Show PNG");
    expect(source).toContain("Save as image");
    expect(source).toContain("setMessage(messageText)");
    expect(source).toContain("setSavedPlanId(null)");
    expect(source).toContain("setComparison(null)");
    expect(source).toContain("setPracticeScore(null)");
    expect(source).toContain("Practice drill swapped. Save the edited plan before upload.");
  });
});
