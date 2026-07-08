import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const clientSource = readFileSync(
  join(process.cwd(), "src/app/achievements/achievements-client.tsx"),
  "utf8",
);
const pageSource = readFileSync(join(process.cwd(), "src/app/achievements/page.tsx"), "utf8");

describe("achievements desktop unlock ledger", () => {
  it("keeps unlocked achievements in a bounded desktop workbench table", () => {
    expect(clientSource).toContain('<Accordion type="single" collapsible>');
    expect(clientSource).toContain('value="achievement-ledger"');
    expect(clientSource).toContain("<AccordionTrigger");
    expect(clientSource).toContain("<AccordionContent");
    expect(clientSource).toContain("DesktopTableWorkbenchControls");
    expect(clientSource).toContain("achievementUnlockColumns");
    expect(clientSource).toContain('viewKey="achievement-unlocks"');
    expect(clientSource).toContain('scope="achievements"');
    expect(clientSource).toContain('exportTableId="achievement-unlocks"');
    expect(clientSource).toContain('data-workbench-export-table="achievement-unlocks"');
    expect(clientSource).toContain('mainTableLabel="Achievement unlock ledger table"');
    expect(clientSource).toContain("stickyFirstColumn");
    expect(clientSource).toContain("forekinghell-achievement-unlocks.csv");
    expect(clientSource).toContain("<TableCaption");
    expect(clientSource).toContain("tabIndex={0}");
    expect(clientSource).toContain("defaultUnlockLedgerLimit = 40");
    expect(clientSource).toContain("visibleAchievements.map");
    expect(clientSource).toContain("Show {Math.min(unlockLedgerPageSize, remainingCount)} more");

    for (const column of [
      "achievement",
      "unlocked",
      "tier",
      "xp",
      "category",
      "source",
      "action",
    ]) {
      expect(clientSource).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the achievement catalogue capped before explicit expansion", () => {
    expect(clientSource).toContain("defaultCatalogueLimit = 72");
    expect(clientSource).toContain("filteredAchievements.slice(0, catalogueLimit)");
    expect(clientSource).toContain(
      "Show {Math.min(cataloguePageSize, remainingFilteredAchievementCount)} more",
    );
  });

  it("keeps achievements as a hub page without a persistent AI rail", () => {
    expect(pageSource).toContain('scope="achievements"');
    expect(pageSource).not.toContain("DesktopInsightRail");
    expect(pageSource).not.toContain("rail={");
  });
});
