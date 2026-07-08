import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/challenges/page.tsx"), "utf8");

describe("challenges desktop board", () => {
  it("uses the challenges artwork variant in the desktop competition header", () => {
    expect(source).toContain('variant="challenges"');
    expect(source).toMatch(/visual=\{\s*<PageArtwork/);
    expect(source).toContain("min-h-36");
  });

  it("keeps live, joined, templates and past boards table-first on desktop", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).toContain("ChallengeBoardTable");
    expect(source).toContain("ChallengeBoardFilterTabs");
    expect(source).toContain("buildChallengeBoardRows");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="challenge-board"');
    expect(source).toContain('exportTableId="challenge-board"');
    expect(source).toContain('data-workbench-export-table="challenge-board"');
    expect(source).toContain('mainTableLabel="Challenge board table"');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain('href: "/challenges?tab=templates"');
    expect(source).toContain('href: "/challenges?tab=past"');

    for (const column of [
      "board",
      "status",
      "visibility",
      "template",
      "window",
      "players",
      "leader",
      "proof",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
