import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildPracticeFocusSummary,
  compactPracticeBlockRow,
  defaultSelectedPracticeBlockId,
  hasPlanVsActualData,
  scoredFromLabel,
  summarizePracticeImportControl,
  type PracticeBlockViewLike,
  type PracticeComparisonViewLike,
} from "@/lib/practice-planner-view";

describe("practice planner view helpers", () => {
  it("shows zero imported progress before an upload is matched", () => {
    const summary = summarizePracticeImportControl({ totalBalls: 30, blocks }, null);

    expect(summary.matchedBlocks).toBe(0);
    expect(summary.importedBalls).toBe(0);
    expect(summary.totalBalls).toBe(30);
    expect(summary.progressPercent).toBe(0);
  });

  it("counts matched blocks and imported balls from uploaded shot data", () => {
    const summary = summarizePracticeImportControl({ totalBalls: 30, blocks }, comparison);

    expect(summary.matchedBlocks).toBe(2);
    expect(summary.importedBalls).toBe(20);
    expect(summary.totalBalls).toBe(30);
    expect(summary.progressPercent).toBe(67);
  });

  it("keeps block totals aligned with the selected ball count", () => {
    const totalBalls = blocks.reduce((total, block) => total + (block.ballCount ?? 0), 0);
    const summary = summarizePracticeImportControl({ totalBalls, blocks }, comparison);

    expect(totalBalls).toBe(30);
    expect(summary.totalBalls).toBe(30);
  });

  it("renders compact block rows with upload-match evidence", () => {
    const row = compactPracticeBlockRow(blocks[1], comparison);

    expect(row).toMatchObject({
      blockLabel: "Block 2",
      typeLabel: "technical",
      title: "5W start line",
      clubLabel: "5W",
      volumeLabel: "10 balls",
      statusLabel: "Passed",
      resultNote: "10 matching shots · planned volume met.",
      importedEvidence: "10/10 matching shots",
    });
    expect(row.successTarget).toContain("6 of 10");
  });

  it("separates repeat-once results from short planned volume", () => {
    const row = compactPracticeBlockRow(blocks[1], {
      decisions: [
        {
          blockId: "baseline",
          actual: "7/6 inside corridor from 7/10 matching shots",
          actualBalls: 7,
          plannedBalls: 10,
          matchedPlannedVolume: false,
          result: "mixed",
          confidence: "medium",
          decision: "repeat_once",
        },
      ],
    });

    expect(row.statusLabel).toBe("Repeat once");
    expect(row.resultNote).toBe("7/10 planned balls found · 3 short.");
    expect(row.importedEvidence).toBe("7/6 inside corridor from 7/10 matching shots");
  });

  it("marks blocks as waiting when no uploaded shots are present", () => {
    const row = compactPracticeBlockRow(blocks[2], null);

    expect(row.statusLabel).toBe("Waiting for upload");
    expect(row.importedEvidence).toBe("Scored after upload.");
  });

  it("marks linked blocks with no club evidence as no matching shots", () => {
    const row = compactPracticeBlockRow(blocks[2], comparison);

    expect(row.statusLabel).toBe("No matching shots");
    expect(row.importedEvidence).toBe("No matching imported shots");
  });

  it("shows all blocks as upload-scored before import", () => {
    const rows = eightyBallBlocks.map((block) => compactPracticeBlockRow(block, null));

    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.importStatus === "waiting_for_upload")).toBe(true);
    expect(rows.every((row) => row.importedEvidence === "Scored after upload.")).toBe(true);
  });

  it("keeps Plan vs Actual empty before import and populated after import", () => {
    expect(hasPlanVsActualData(null)).toBe(false);
    expect(hasPlanVsActualData(comparison)).toBe(true);
  });

  it("selects the main priority block by default", () => {
    expect(defaultSelectedPracticeBlockId(eightyBallBlocks)).toBe("main");
  });

  it("summarizes the practice cockpit focus without reading every block", () => {
    const summary = buildPracticeFocusSummary({ totalBalls: 80, blocks: eightyBallBlocks });

    expect(summary).toMatchObject({
      main: "5W start line",
      secondary: "5i start line",
      scoring: "SW wedge ladder",
      maintenance: null,
      totalPlannedBalls: 80,
      blockCount: 6,
    });
    expect(summary.howToPractice).toBe("start-line gate -> wedge ladder -> random finish");
  });

  it("uses imported shot data as the scoring source label", () => {
    expect(scoredFromLabel(eightyBallBlocks[2])).toBe("5W imported shots after upload.");
  });

  it("keeps the page as one selected detail cockpit, not a manual scorecard", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/practice/practice-planner-client.tsx"),
      "utf8",
    );

    expect(source).toContain("SelectedBlockDetail");
    expect(source).toContain("PracticeResultsOverview");
    expect(source).toContain("Analysed from upload");
    expect(source).toContain("sm:grid-cols-12");
    expect(source).toContain("sm:col-span-5 xl:col-span-4");
    expect(source).toContain("sm:col-span-2 xl:col-span-3");
    expect(source.indexOf("<PracticeAgenda")).toBeLessThan(source.indexOf("<SelectedBlockDetail"));
    expect(source.indexOf("<SelectedBlockDetail")).toBeLessThan(
      source.indexOf("<SessionControlPanel"),
    );
    expect(source).not.toContain("Accordion");
    expect(source).not.toContain('type="multiple"');
    expect(source).not.toContain("Adapt next");
    expect(source).not.toMatch(/<Input[\\s\\S]{0,240}(score|Score)/);
    expect(source).toContain("Planned drill score appears after upload.");
    expect(source).toContain("PracticeSessionImportBar");
    expect(source).toContain("Score the planned drill");
    expect(source).toContain("This does not grade the whole session.");
    expect(source).toContain("it does not grade the whole");
    expect(source).toContain("linkPracticePlanSessionAction");
  });

  it("prioritises the latest import's matched plan over an older open plan", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/practice/page.tsx"), "utf8");

    expect(source).toContain("selectPracticePlannerInitialSavedPlan(");
    expect(source).toContain("data.importOptions[0]?.id ?? null");
    expect(source).toContain("const initialPlan = initialSavedPracticePlan ?? generatedPlan");
    expect(source).toContain(
      "await getLatestPracticeSessionReviewSafely(userId, initialSavedPracticePlan)",
    );
    expect(source).not.toContain('status === "analysed" || plan.status === "completed"');
  });

  it("loads recent uploaded sessions for explicit practice linking", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/practice-planner.ts"), "utf8");

    expect(source).toContain("getPracticeImportOptions(userId)");
    expect(source).toContain("completePracticePlanFromSelectedImport");
    expect(source).toContain("recordPracticePlanMatch(userId, saved, sessionSummary, match, true)");
  });
});

const blocks: PracticeBlockViewLike[] = [
  {
    id: "warmup",
    order: 1,
    type: "warmup",
    title: "Warm-up",
    clubs: ["pw", "8i"],
    ballCount: 10,
    timeMinutes: 6,
    successTarget: "8 of 10 playable",
  },
  {
    id: "baseline",
    order: 2,
    type: "technical",
    title: "5W start line",
    clubs: ["5w"],
    ballCount: 10,
    timeMinutes: 8,
    successTarget: "6 of 10 start inside corridor",
  },
  {
    id: "transfer",
    order: 3,
    type: "random",
    title: "Transfer finish",
    clubs: ["5w", "sw"],
    ballCount: 10,
    timeMinutes: 8,
    successTarget: "7 of 10 playable",
  },
];

const eightyBallBlocks: PracticeBlockViewLike[] = [
  {
    id: "warmup",
    order: 1,
    type: "warmup",
    title: "Warm-up",
    clubs: ["pw", "8i", "6i"],
    ballCount: 10,
    timeMinutes: 6,
    successTarget: "8 of 10 playable",
  },
  {
    id: "baseline",
    order: 2,
    type: "baseline",
    title: "Baseline check",
    clubs: ["5w", "sw"],
    ballCount: 10,
    timeMinutes: 7,
    successTarget: "6 playable or inside carry target",
  },
  {
    id: "main",
    order: 3,
    type: "technical",
    title: "Main priority: 5W start line",
    clubs: ["5w"],
    ballCount: 20,
    timeMinutes: 12,
    successTarget: "12 of 20 start inside the corridor",
  },
  {
    id: "secondary",
    order: 4,
    type: "technical",
    title: "Secondary priority: 5i start line",
    clubs: ["5i"],
    ballCount: 15,
    timeMinutes: 9,
    successTarget: "9 of 15 start inside the corridor",
  },
  {
    id: "scoring",
    order: 5,
    type: "scoring",
    title: "SW wedge ladder",
    clubs: ["sw"],
    ballCount: 15,
    timeMinutes: 8,
    successTarget: "10 of 15 inside carry window",
  },
  {
    id: "transfer",
    order: 6,
    type: "random",
    title: "Random finish",
    clubs: ["5w", "5i", "sw", "driver"],
    ballCount: 10,
    timeMinutes: 8,
    successTarget: "7 of 10 playable",
  },
];

const comparison: PracticeComparisonViewLike = {
  decisions: [
    {
      blockId: "warmup",
      actual: "15/10 matching shots",
      actualBalls: 15,
      matchedPlannedVolume: true,
      decision: "maintain",
    },
    {
      blockId: "baseline",
      actual: "10/10 matching shots",
      actualBalls: 10,
      matchedPlannedVolume: true,
      decision: "move_down",
    },
    {
      blockId: "transfer",
      actual: "No matching imported shots",
      actualBalls: 0,
      matchedPlannedVolume: false,
      decision: "keep_priority",
    },
  ],
};
