import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/equipment/page.tsx"), "utf8");
const confirmSource = readFileSync(
  join(process.cwd(), "src/components/app/confirm-submit-button.tsx"),
  "utf8",
);

describe("equipment desktop tables", () => {
  it("ships only the desktop equipment graph on this desktop-only route", () => {
    expect(source).toContain('<DesktopWorkbenchLayout scope="equipment">');
    for (const obsolete of [
      "getRequestAppSurface",
      "MobileAppShell",
      "MobileBentoSummary",
      "MobileDataCard",
      "MobileDataList",
      "IOSDisclosureGroup",
      "mobile={",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
  });

  it("keeps equipment history and retired clubs in desktop workbench tables", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="equipment-history"');
    expect(source).toContain('data-workbench-export-table="equipment-history"');
    expect(source).toContain('mainTableLabel="Equipment history table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain('data-workbench-scope="retired-clubs"');
    expect(source).toContain('data-workbench-export-table="retired-clubs"');
    expect(source).toContain('mainTableLabel="Retired club inventory table"');
    expect(source).toContain("forekinghell-equipment-history.csv");
    expect(source).toContain("forekinghell-retired-clubs.csv");
    expect(source).toContain("tabIndex={0}");
  });

  it("keeps equipment focused on deterministic setup evidence", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("keeps current setup cards readable on laptop-width desktops", () => {
    expect(source).toContain("lg:grid-cols-4 2xl:grid-cols-5");
    expect(source).not.toContain("lg:grid-cols-4 xl:grid-cols-5");
  });

  it("keeps equipment impact cards from squeezing long club model names", () => {
    expect(source).toContain("md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4");
    expect(source).not.toContain("md:grid-cols-2 xl:grid-cols-4");
  });

  it("uses theme-aware ordinary controls and table surfaces", () => {
    expect(source).toContain('className="min-h-11 rounded-xl bg-card"');
    expect(source).toContain('className="min-h-11 w-full bg-card"');
    expect(source).toContain("[&_th]:bg-card");
    expect(source).not.toMatch(/\b(?:bg-white|bg-slate-\d+|text-slate-\d+|border-slate-\d+)\b/);
    expect(source).not.toMatch(
      /(?:bg|text|border|hover:bg|hover:border)-(?:emerald|sky|amber)-\d+|bg-\[#[0-9A-Fa-f]+\]/,
    );
  });

  it("preserves all equipment mutations after removing the obsolete companion tree", () => {
    expect(source).toContain("captureEquipmentSnapshotAction");
    expect(source).toContain("createBallModelAction");
    expect(source).toContain("saveEquipmentHistoryAction");
    expect(source).toContain("<RetireClubForm");
  });

  it("confirms the destructive retire-club action through the shared AlertDialog flow", () => {
    const retireSource = source.slice(
      source.indexOf("function RetireClubForm"),
      source.indexOf("async function getEquipmentData"),
    );

    expect(retireSource).toContain("<form action={retireClubAction}>");
    expect(retireSource).toContain("<ConfirmSubmitButton");
    expect(retireSource).toContain('confirmTitle="Retire club"');
    expect(retireSource).toContain('confirmActionLabel="Retire club"');
    expect(retireSource).toContain("shot and equipment history remain available");
    expect(retireSource).not.toContain("<Button");
    expect(confirmSource).toContain("<AlertDialog open={open}");
    expect(confirmSource).toContain("requestSubmit(buttonRef.current)");
  });
});
