import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/speed/page.tsx"), "utf8");

describe("speed centre desktop evidence ledger", () => {
  it("keeps the wider distance-loss diagnosis out of the speed workbench", () => {
    expect(source).not.toContain("DistanceLossDiagnosisPanel");
    expect(source).not.toContain("What is driving the distance loss?");
  });

  it("uses the speed artwork variant in the desktop header", () => {
    expect(source).toContain('variant="speed"');
    expect(source).toContain("visual={<PageArtwork");
    expect(source).toContain("min-h-36");
  });

  it("keeps recent speed evidence in an exportable desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="speed-evidence"');
    expect(source).toContain('scope="speed"');
    expect(source).toContain('exportTableId="speed-evidence"');
    expect(source).toContain('data-workbench-scope="speed"');
    expect(source).toContain('data-workbench-export-table="speed-evidence"');
    expect(source).toContain('mainTableLabel="Speed evidence session ledger"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("forekinghell-speed-evidence.csv");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");
    expect(source).toContain("SpeedEvidenceCard");

    for (const column of [
      "session",
      "date",
      "source",
      "count",
      "avg",
      "max",
      "min",
      "target",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("does not add a persistent AI rail to the speed centre", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});

describe("speed centre mobile information architecture", () => {
  it("puts the answer and next action before the deeper evidence", () => {
    expect(source.indexOf("<MobileSpeedAnswer")).toBeGreaterThan(-1);
    expect(source.indexOf("<MobileSpeedDisclosures")).toBeGreaterThan(
      source.indexOf("<MobileSpeedAnswer"),
    );
    expect(source.indexOf('<DesktopWorkbenchLayout scope="speed">')).toBeGreaterThan(
      source.indexOf("<MobileSpeedDisclosures"),
    );
    expect(source).toContain("data-mobile-speed-answer");
    expect(source).toContain('aria-labelledby="mobile-speed-title"');
    expect(source).toContain("data-primary-action");
    expect(source).toContain("Log session");

    const answer = source.slice(
      source.indexOf("function MobileSpeedAnswer"),
      source.indexOf("function MobileSpeedDisclosures"),
    );
    expect(answer.indexOf("Next action")).toBeLessThan(
      answer.indexOf('label="Current speed summary"'),
    );
  });

  it("uses one-level disclosure for secondary speed work", () => {
    const disclosures = source.slice(
      source.indexOf("function MobileSpeedDisclosures"),
      source.indexOf("function MobileSpeedTrendEvidence"),
    );

    expect(disclosures).toContain("IOSDisclosureGroup");
    expect(disclosures).toContain('key={openLogByDefault ? "log-open" : "collapsed"}');
    expect(disclosures).toContain('defaultValue={openLogByDefault ? "log-session" : undefined}');

    for (const section of [
      "Trend & transfer",
      "Club evidence",
      "Recent sessions",
      "Goals",
      "Speed potential",
      "Athletic development",
      "Log speed",
    ]) {
      expect(disclosures).toContain(section);
    }

    expect(disclosures).not.toContain("<details");
  });

  it("replaces the wide all-club card grid with linked native rows on mobile", () => {
    const clubEvidence = source.slice(
      source.indexOf("function MobileClubSpeedEvidence"),
      source.indexOf("function MobileRecentSpeedEvidence"),
    );

    expect(clubEvidence).toContain("IOSGroupedList");
    expect(clubEvidence).toContain("IOSListRow");
    expect(clubEvidence).toContain("/speed?club=");
    expect(clubEvidence).toContain("transferStatusLabel(row)");
    expect(clubEvidence).not.toContain("ClubSpeedRowCard");
    expect(clubEvidence).not.toContain("<Table");
  });

  it("uses native rows for the mobile trend baseline while retaining the real chart", () => {
    expect(source).toContain("<MobileSpeedTrendStarter");
    expect(source).toContain("function MobileSpeedTrendStarter");
    expect(source).toContain('label="Speed trend baseline"');
    expect(source).toContain("<SpeedTrendChart");
  });

  it("keeps real goal and session actions available in focused mobile forms", () => {
    expect(source).toContain("<form action={updateSpeedGoalsAction}");
    expect(source).toContain("<form action={createManualSpeedSessionAction}");
    expect(source).toContain('name="speedReadings"');
    expect(source).toContain('name="driverGlobalTarget"');
    expect(source).toContain("name={`clubTarget:${club.id}`}");
    expect(source).toContain('inputMode="decimal"');
  });
});
