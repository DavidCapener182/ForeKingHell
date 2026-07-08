import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/equipment/page.tsx"), "utf8");

describe("equipment desktop tables", () => {
  it("keeps equipment history and retired clubs in desktop workbench tables", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="equipment-history"');
    expect(source).toContain('data-workbench-export-table="equipment-history"');
    expect(source).toContain('mainTableLabel="Equipment history table"');
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
