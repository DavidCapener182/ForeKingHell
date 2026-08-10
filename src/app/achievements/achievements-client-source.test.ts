import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const clientSource = readFileSync(
  join(process.cwd(), "src/app/achievements/achievements-client.tsx"),
  "utf8",
);
const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/achievements/page.tsx"), "utf8");
const globalsSource = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const notificationSource = readFileSync(
  join(process.cwd(), "src/components/achievement-notifications.tsx"),
  "utf8",
);
const rapsodoSyncSource = readFileSync(
  join(process.cwd(), "src/app/rapsodo/rapsodo-sync-client.tsx"),
  "utf8",
);

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
    expect(clientSource).toContain('data-workbench-scope="achievements"');
    expect(clientSource).toContain('data-workbench-export-table="achievement-unlocks"');
    expect(clientSource).toContain('mainTableLabel="Achievement unlock ledger table"');
    expect(clientSource).toContain("stickyFirstColumn");
    expect(clientSource).toContain("forekinghell-achievement-unlocks.csv");
    expect(clientSource).toContain("<TableCaption");
    expect(clientSource).toContain("tabIndex={0}");
    expect(clientSource).toContain("focus-aaa outline-none");
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

  it("opens focused achievement deep links in the mobile Catalogue tab", () => {
    expect(clientSource).toContain(
      "const [mobileTab, setMobileTab] = useState<MobileAchievementTab>(() =>",
    );
    expect(clientSource).toContain('focusAchievementId ? "catalogue" : "next"');
    expect(pageSource).toContain('key={focusAchievementId || "achievement-hub"}');
  });

  it("keeps the dedicated mobile composition active until lg", () => {
    expect(pageSource).toContain(
      '<MobileRouteHeader title="Achievements" group="improve" activeKey="achievements" />',
    );
    expect(pageSource).toContain('className="premium-card p-3 lg:hidden"');
    expect(pageSource).toContain('className="hidden lg:block"');
    expect(clientSource).toContain('className="lg:hidden"');
    expect(clientSource).not.toContain('className="sm:hidden"');
  });

  it("keeps recent mobile unlocks concise and discloses their evidence", () => {
    expect(clientSource).toContain("data.recentUnlocks.slice(0, 3).map");
    expect(clientSource).toContain('onClick={() => setMobileTab("calendar")}');
    expect(clientSource).toContain("aria-pressed={item.id === tab}");
    expect(clientSource).toContain("RecentUnlockEvidence");
    expect(clientSource).toContain("No source evidence stored");
    expect(clientSource).toContain('className="hidden gap-3 md:grid-cols-4 lg:grid"');
    expect(clientSource).not.toContain('<span className="min-w-0 truncate">{value}</span>');
  });

  it("preserves translucent overlays inside intentional dark surfaces", () => {
    expect(clientSource).toContain("data-mobile-preserve-dark");
    expect(notificationSource).toContain("data-mobile-preserve-dark");
    expect(rapsodoSyncSource).toContain("data-mobile-preserve-dark");
    expect(globalsSource).toContain('[data-mobile-preserve-dark] [class*="bg-white/"]');
  });
});
