import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const clientSource = readFileSync(
  join(process.cwd(), "src/app/achievements/achievements-client.tsx"),
  "utf8",
);
const ledgerSource = readFileSync(
  join(process.cwd(), "src/app/achievements/achievement-unlock-ledger.tsx"),
  "utf8",
);
const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/achievements/page.tsx"), "utf8");
const globalsSource = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const notificationSource = readFileSync(
  join(process.cwd(), "src/components/achievement-notifications.tsx"),
  "utf8",
);

describe("achievements desktop unlock ledger", () => {
  it("keeps unlocked achievements in a bounded desktop workbench table", () => {
    expect(ledgerSource).toContain('<Accordion type="single" collapsible>');
    expect(ledgerSource).toContain('value="achievement-ledger"');
    expect(ledgerSource).toContain("<AccordionTrigger");
    expect(ledgerSource).toContain("<AccordionContent");
    expect(ledgerSource).toContain("DesktopTableWorkbenchControls");
    expect(ledgerSource).toContain("achievementUnlockColumns");
    expect(ledgerSource).toContain('viewKey="achievement-unlocks"');
    expect(ledgerSource).toContain('scope="achievements"');
    expect(ledgerSource).toContain('exportTableId="achievement-unlocks"');
    expect(ledgerSource).toContain('data-workbench-scope="achievements"');
    expect(ledgerSource).toContain('data-workbench-export-table="achievement-unlocks"');
    expect(ledgerSource).toContain('mainTableLabel="Achievement unlock ledger table"');
    expect(ledgerSource).toContain("stickyFirstColumn");
    expect(ledgerSource).toContain("forekinghell-achievement-unlocks.csv");
    expect(ledgerSource).toContain("<TableCaption");
    expect(ledgerSource).toContain("tabIndex={0}");
    expect(ledgerSource).toContain("focus-aaa outline-none");
    expect(ledgerSource).toContain("defaultUnlockLedgerLimit = 40");
    expect(ledgerSource).toContain("visibleAchievements.map");
    expect(ledgerSource).toContain("Show {Math.min(unlockLedgerPageSize, remainingCount)} more");

    for (const column of [
      "achievement",
      "unlocked",
      "tier",
      "xp",
      "category",
      "source",
      "action",
    ]) {
      expect(ledgerSource).toContain(`data-column="${column}"`);
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

  it("selects one achievements composition from the request surface", () => {
    expect(pageSource).toContain("getRequestAppSurface()");
    expect(pageSource).toContain('if (surface === "companion")');
    expect(pageSource).toContain(
      '<MobileRouteHeader title="Achievements" group="improve" activeKey="achievements" />',
    );
    expect(pageSource).toContain("data-achievements-companion");
    expect(pageSource).toContain('presentation="companion"');
    expect(pageSource).toContain("data-achievements-workbench");
    expect(pageSource).toContain('presentation="workbench"');
    expect(pageSource).toContain('import("@/components/app/desktop-workbench")');
    expect(pageSource).not.toMatch(/(?:^|\s)(?:lg:hidden|hidden lg:)/);
    expect(clientSource).not.toMatch(/(?:^|\s)(?:lg:hidden|hidden lg:)/);
  });

  it("loads desktop table controls only for the workbench presentation", () => {
    expect(clientSource).toContain('presentation: "companion" | "workbench"');
    expect(clientSource).toContain('const isCompanion = presentation === "companion"');
    expect(clientSource).toContain('import("@/app/achievements/achievement-unlock-ledger").then');
    expect(clientSource).toContain("module.AchievementUnlockLedger");
    expect(clientSource).toContain("!isCompanion ? <AchievementUnlockLedger");
    expect(clientSource).not.toContain("DesktopTableWorkbenchControls");
    expect(clientSource).not.toContain('from "@/components/ui/table"');
    expect(ledgerSource).toContain("DesktopTableWorkbenchControls");
  });

  it("keeps recent mobile unlocks concise and discloses their evidence", () => {
    expect(clientSource).toContain("data.recentUnlocks.slice(0, 3).map");
    expect(clientSource).toContain('onClick={() => setMobileTab("calendar")}');
    expect(clientSource).toContain("data-achievement-view-tabs");
    expect(clientSource).toContain("RecentUnlockEvidence");
    expect(clientSource).toContain("No source evidence stored");
    expect(clientSource).toContain('<section className="grid gap-3 md:grid-cols-4">');
    expect(clientSource).toContain('presentation="companion"');
    expect(clientSource).toContain('presentation="workbench"');
    expect(clientSource).not.toContain('<span className="min-w-0 truncate">{value}</span>');
  });

  it("uses themed shadcn controls for trophy filters, companion views and calendar days", () => {
    expect(clientSource).toContain('from "@/components/ui/toggle-group"');
    expect(clientSource).toContain('aria-label="Filter trophy cabinet by tier"');
    expect(clientSource).toContain("data-trophy-tier-filter");
    expect(clientSource).toContain("<ToggleGroupItem");
    expect(clientSource).toContain("data-achievement-view-tabs");
    expect(clientSource).toContain("data-achievement-calendar-day");
    expect(clientSource).toContain('variant={cell.isSelected ? "default" : "outline"}');
    expect(clientSource).not.toContain("<button");
    expect(clientSource).not.toContain("hover:bg-amber-50/70");
    expect(clientSource).not.toContain('cell.isSelected ? "bg-white text-zinc-900"');
    expect(clientSource).not.toContain("border-border bg-white hover:bg-[#f3f4f6]");
  });

  it("uses semantic theme tokens for tier labels and calendar unlock XP", () => {
    const tierStyleSource =
      clientSource.match(
        /const tierStyles: Record<AchievementTier, string> = \{[\s\S]*?\n\};/,
      )?.[0] ?? "";
    const calendarUnlockSource =
      clientSource.match(/function CalendarUnlockItem[\s\S]*?function RecentUnlock/)?.[0] ?? "";

    expect(tierStyleSource).toContain("var(--status-warning-surface)");
    expect(tierStyleSource).toContain("var(--status-information-surface)");
    expect(tierStyleSource).toContain("bg-muted");
    expect(tierStyleSource).toContain("bg-primary/10");
    expect(tierStyleSource).toContain("bg-primary text-primary-foreground");
    expect(tierStyleSource).toContain("border-dashed border-border bg-background");
    expect(tierStyleSource).not.toMatch(
      /(?:border|bg|text)-(?:amber|slate|yellow|cyan|indigo|zinc)(?:-|\b)/,
    );

    expect(calendarUnlockSource).toContain("var(--status-success-foreground)");
    expect(calendarUnlockSource).not.toMatch(/text-(?:emerald|green)(?:-|\b)/);
  });

  it("keeps the trophy filter and calendar panels flat inside their section Cards", () => {
    const trophyFilter =
      clientSource.match(
        /export function TrophyTierFilter[\s\S]*?function MobileAchievementTabs/,
      )?.[0] ?? "";
    const calendar =
      clientSource.match(
        /export function AchievementUnlockCalendar[\s\S]*?type TrophyTierSummary/,
      )?.[0] ?? "";

    expect(trophyFilter).toContain("data-trophy-tier-section");
    expect(trophyFilter).toContain("<ToggleGroup");
    expect(trophyFilter).not.toMatch(/<Card(?:\s|>)/);
    expect(calendar.match(/<Card(?:\s|>)/g)).toHaveLength(1);
    expect(calendar).toContain("data-achievement-calendar-month");
    expect(calendar).toContain("data-achievement-calendar-detail");
    expect(calendar).not.toContain('<Card className="bg-card shadow-none">');
  });

  it("keeps catalogue results flat and theme-safe inside the catalogue Card", () => {
    const catalogueResult =
      clientSource.match(
        /export function AchievementCard[\s\S]*?function AchievementBadgeIcon/,
      )?.[0] ?? "";

    expect(catalogueResult).toContain("<Item");
    expect(catalogueResult).toContain("data-achievement-catalogue-item");
    expect(catalogueResult).not.toMatch(/<Card(?:\s|>)/);
    expect(catalogueResult).toContain("var(--status-success-border)");
    expect(catalogueResult).toContain("var(--status-success-surface)");
    expect(catalogueResult).toContain("ring-ring/40");
    expect(catalogueResult).toContain("hover:border-primary/50");
    expect(catalogueResult).not.toMatch(/(?:border|bg|text|ring)-(?:emerald|green|slate)(?:-|\b)/);

    expect(clientSource).toContain("var(--status-information-surface)");
    expect(clientSource).toContain("border-dashed border-border bg-muted/35");
    expect(clientSource).not.toContain("border-slate-300 bg-white/70");
  });

  it("preserves translucent overlays inside intentional dark surfaces", () => {
    expect(clientSource).toContain("data-mobile-preserve-dark");
    expect(notificationSource).toContain("data-mobile-preserve-dark");
    expect(globalsSource).toContain('[data-mobile-preserve-dark] [class*="bg-white/"]');
  });
});
