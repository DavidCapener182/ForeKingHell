import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/equipment/page.tsx"), "utf8");

describe("equipment desktop tables", () => {
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
});

describe("equipment mobile information architecture", () => {
  it("leads with bag fit and a scannable owned-club list", () => {
    const mobileSource = source.slice(
      source.indexOf("function MobileEquipmentExperience"),
      source.indexOf("function EquipmentMobileDisclosure"),
    );

    expect(mobileSource).toContain('label="Bag fit"');
    expect(mobileSource).toContain('label="Weak window"');
    expect(mobileSource).toContain('title="Owned setup"');
    expect(mobileSource).toContain("profiles.map((profile)");
    expect(mobileSource).toContain("href={`/bag/${profile.club.id}`}");
    expect(mobileSource).toContain('href="#equipment-mobile-actions"');
    expect(source).toContain('className="hidden lg:grid"');
  });

  it("keeps secondary setup work in a single-level native disclosure group", () => {
    expect(source).toContain(
      '<IOSDisclosureGroup\n            label="Equipment detail and actions"',
    );
    expect(source).toContain('value: "score"');
    expect(source).toContain('value: "timeline"');
    expect(source).toContain('value: "impact"');
    expect(source).toContain('value: "builder"');
    expect(source).toContain('value: "forms"');
    expect(source).toContain('value: "history"');
    expect(source).toContain("captureEquipmentSnapshotAction");
    expect(source).toContain("createBallModelAction");
    expect(source).toContain("saveEquipmentHistoryAction");
    expect(source).toContain("<RetireClubForm");
  });
});
