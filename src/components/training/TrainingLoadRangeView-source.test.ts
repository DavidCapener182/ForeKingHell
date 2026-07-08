import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/training/TrainingLoadRangeView.tsx"),
  "utf8",
);

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
