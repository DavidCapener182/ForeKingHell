import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/rounds/[sessionId]/page.tsx"),
  "utf8",
);
const tabsSource = readFileSync(
  join(process.cwd(), "src/app/rounds/[sessionId]/round-review-tabs.tsx"),
  "utf8",
);

function functionBlock(name: string, nextName: string) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  return source.slice(start, end);
}

describe("round review scoring and learning redesign", () => {
  it("uses the five focused review tabs on desktop and mobile", () => {
    for (const tab of ["Summary", "Scorecard", "Map", "Evidence", "Corrections"]) {
      expect(tabsSource).toContain(tab);
    }
    expect(source.match(/<LazyRoundReviewTabs/g)).toHaveLength(2);
    expect(tabsSource).toContain("overflow-x-auto");
  });

  it("makes the summary result-led and keeps its five learning answers together", () => {
    const summary = functionBlock("RoundLearningSummary", "LearningRow");

    expect(summary).toContain("Final score");
    expect(summary).toContain("<ScoringBreakdown");
    expect(summary).toContain('label="Best part"');
    expect(summary).toContain('label="Costliest part"');
    expect(summary).toContain('label="Turning point"');
    expect(summary).toContain('label="Strategy result"');
    expect(summary).toContain('label="Next practice action"');
    expect(summary).not.toContain("OfflineRoundEditForm");
  });

  it("renders a modern read-only digital scorecard with golf-specific columns", () => {
    const scorecard = functionBlock("DigitalRoundScorecard", "ScoreMark");

    for (const label of ["Hole", "Par", "Score", "Putts", "GIR", "Penalty"]) {
      expect(scorecard).toContain(`>${label}<`);
    }
    expect(scorecard).toContain("data-digital-scorecard");
    expect(scorecard).toContain("<ScoreMark");
    expect(scorecard).not.toContain("OfflineRoundEditForm");
  });

  it("keeps the specialist map dominant in its own view", () => {
    expect(source).toContain('view === "map"');
    expect(source).toContain("<LazyRoundShotMap");
    expect(source).toContain('className="overflow-hidden rounded-xl bg-slate-950');
  });

  it("keeps evidence concise and all editing in corrections", () => {
    const evidence = functionBlock("RoundEvidenceSummary", "MiniSummaryStat");

    expect(evidence).toContain("Scorecard");
    expect(evidence).toContain("Course & tee");
    expect(evidence).toContain("Shot evidence");
    expect(evidence).toContain("Proof status");
    expect(evidence).not.toContain("OfflineRoundEditForm");

    expect(source).toContain('view === "corrections"');
    expect(source).toContain("<OfflineRoundEditForm");
    expect(source).toContain("<RoundCorrectionsPanel shotCount={round.shots.length}>");
    expect(source).toContain('data-workbench-export-table="round-shots"');
  });

  it("makes the completed mobile summary understandable at a glance", () => {
    const result = functionBlock("MobileRoundResultCard", "MobileRoundFirstCard");

    expect(result).toContain("Final score");
    expect(result).toContain("text-[42px]");
    expect(result).toContain('label="Best part"');
    expect(result).toContain('label="Costliest part"');
    expect(result).toContain('label="Next practice action"');
    expect(result).toContain("<ScoringBreakdown");
  });

  it("continues to defer correction-only client code", () => {
    expect(source).toContain('view === "corrections" && hasClubData');
    expect(source).toContain('await import("@/app/rounds/[sessionId]/round-corrections-panel")');
  });
});
