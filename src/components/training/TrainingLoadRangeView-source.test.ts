import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/training/TrainingLoadRangeView.tsx"),
  "utf8",
);
const formSource = readFileSync(
  join(process.cwd(), "src/components/training/TrainingSessionForm.tsx"),
  "utf8",
);
const suggestionsSource = readFileSync(
  join(process.cwd(), "src/components/training/TrainingSourceSuggestions.tsx"),
  "utf8",
);

function componentBody(name: string, nextName: string) {
  const start = source.indexOf(`function ${name}`);
  const exportStart = source.indexOf(`export function ${name}`);
  const resolvedStart = Math.max(start, exportStart);
  const end = source.indexOf(`function ${nextName}`, resolvedStart + 1);
  expect(resolvedStart).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(resolvedStart);
  return source.slice(resolvedStart, end);
}

describe("TrainingLoadRangeView desktop workbench", () => {
  it("exposes the selected training range as a desktop exportable session table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('id="training-load-sessions"');
    expect(source).toContain('data-workbench-scope="training-load-sessions"');
    expect(source).toContain('data-workbench-export-table="training-load-sessions"');
    expect(source).toContain('mainTableLabel="Training load session table"');
    expect(source).toContain('mainTableLabel="Training load session table" stickyFirstColumn');
    expect(source).toContain('{ key: "sessionQuality", label: "Session Quality" }');
    expect(source).toContain("Latest scored session quality");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("No training load sessions are logged in this range.");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
  });
});

describe("Training Load native mobile information architecture", () => {
  it("puts current golf form and the next action before historical evidence", () => {
    const mobile = componentBody("MobileTrainingLoadRangeView", "MobileWeeklyTrainingRows");

    expect(mobile.indexOf("Current golf form")).toBeLessThan(mobile.indexOf("Next action"));
    expect(mobile.indexOf("Next action")).toBeLessThan(mobile.indexOf("Evidence and history"));
    expect(mobile).toContain("Training fitness");
    expect(mobile).toContain("Recent load");
    expect(mobile).toContain("Practice Planner fit");
    expect(mobile).toContain("<BottomSheet");
  });

  it("keeps charts specialist and replaces phone ledgers with one-level disclosure rows", () => {
    const mobile = componentBody("MobileTrainingLoadRangeView", "MobileWeeklyTrainingRows");

    for (const section of [
      "Golf form trend",
      "Recovery detail",
      "Weekly rhythm",
      "Daily swing load",
      "Training ledger",
      "Training response",
      "Sessions ready to link",
    ]) {
      expect(mobile).toContain(section);
    }

    expect(mobile).toContain('label="Training load evidence and history"');
    expect(mobile).not.toContain("<Table");
    expect(source).toContain("<TrainingSessionLedger");
    expect(source).toContain("<TrainingOverTimeChart");
    expect(source).toContain("<TrainingLoadBars");
  });

  it("gives duplicated mobile and desktop forms unique accessible control ids", () => {
    expect(source).toContain('idPrefix="mobile-training-load"');
    expect(source).toContain('idPrefix="mobile-suggested-rpe"');
    expect(formSource).toContain('idPrefix = "training-load"');
    expect(suggestionsSource).toContain('idPrefix = "suggested-rpe"');
    expect(formSource).toContain("`${idPrefix}-rpe`");
    expect(suggestionsSource).toContain("`${idPrefix}-${safeId(suggestion.key)}`");
  });
});
