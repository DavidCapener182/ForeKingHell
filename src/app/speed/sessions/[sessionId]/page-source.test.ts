import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/speed/sessions/[sessionId]/page.tsx"),
  "utf8",
);

describe("speed session desktop swing log", () => {
  it("uses the shared desktop workbench shell without adding a contextual rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="speed-session">');
    expect(source).toContain("</DesktopWorkbenchLayout>");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps individual swings in a desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('id="speed-session-swing-log"');
    expect(source).toContain('data-workbench-scope="speed-session-swings"');
    expect(source).toContain('data-workbench-export-table="speed-session-swings"');
    expect(source).toContain('mainTableLabel="Speed session swing log table"');
    expect(source).toContain('mainTableLabel="Speed session swing log table" stickyFirstColumn');
    expect(source).toContain("tabIndex={0}");
  });

  it("keeps the speed session detail page focused on data and editing", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
