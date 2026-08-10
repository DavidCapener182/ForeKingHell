import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/speed/sessions/[sessionId]/page.tsx"),
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

describe("speed session mobile information architecture", () => {
  it("shows the session outcome before mobile evidence and the desktop workbench", () => {
    expect(source.indexOf("<MobileSpeedSessionAnswer")).toBeGreaterThan(-1);
    expect(source.indexOf("<MobileSpeedSessionDisclosures")).toBeGreaterThan(
      source.indexOf("<MobileSpeedSessionAnswer"),
    );
    expect(source.indexOf('<DesktopWorkbenchLayout scope="speed-session">')).toBeGreaterThan(
      source.indexOf("<MobileSpeedSessionDisclosures"),
    );
    expect(source).toContain("data-mobile-speed-session-answer");
    expect(source).toContain('aria-labelledby="mobile-speed-session-title"');
    expect(source).toContain("Session average");
    expect(source).toContain("data-primary-action");

    const answer = source.slice(
      source.indexOf("function MobileSpeedSessionAnswer"),
      source.indexOf("function MobileSpeedSessionDisclosures"),
    );
    expect(answer.indexOf("Next action")).toBeLessThan(
      answer.indexOf('label="Speed session summary"'),
    );
  });

  it("uses a single disclosure level for evidence, metadata and editing", () => {
    const disclosures = source.slice(
      source.indexOf("function MobileSpeedSessionDisclosures"),
      source.indexOf("function MobileSwingEvidence"),
    );

    expect(disclosures).toContain("IOSDisclosureGroup");
    expect(disclosures).toContain('key={openEditByDefault ? "edit-open" : "collapsed"}');
    expect(disclosures).toContain('defaultValue={openEditByDefault ? "edit-session" : undefined}');
    expect(disclosures).toContain("Swing evidence");
    expect(disclosures).toContain("Session details");
    expect(disclosures).toContain("Edit session");
    expect(disclosures).not.toContain("<details");
  });

  it("renders every swing as a native row with the useful calculated evidence", () => {
    const swingEvidence = source.slice(
      source.indexOf("function MobileSwingEvidence"),
      source.indexOf("function MobileSpeedSessionMetadata"),
    );

    expect(swingEvidence).toContain("IOSGroupedList");
    expect(swingEvidence).toContain("IOSListRow");
    expect(swingEvidence).toContain("rollingAverage(");
    expect(swingEvidence).toContain("speedSwingPhase(");
    expect(swingEvidence).toContain("speedSwingSignal(");
    expect(swingEvidence).not.toContain("<Table");
  });

  it("keeps correction and deletion server actions available on mobile", () => {
    expect(source).toContain("<form action={updateSpeedSessionAction}");
    expect(source).toContain("<form action={deleteSpeedSessionAction}");
    expect(source).toContain("ConfirmSubmitButton");
    expect(source).toContain('name="speedReadings"');
    expect(source).toContain('name="targetSpeedMph"');
    expect(source).toContain('inputMode="decimal"');
  });
});
