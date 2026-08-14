import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("cross-tab navigation targets", () => {
  it("opens saved views in the tab or section that owns their target", () => {
    const bag = read("src/app/(app)/bag/page.tsx");
    const providers = read("src/app/(app)/providers/page.tsx");
    const settings = read("src/app/(app)/settings/page.tsx");
    const coach = read("src/app/(app)/coach/page.tsx");
    const courseHoles = read("src/app/(app)/courses/[courseId]/holes/page.tsx");
    const dashboard = read("src/app/(app)/dashboard/page.tsx");
    const equipment = read("src/app/(app)/equipment/page.tsx");
    const handicap = read("src/app/(app)/handicap/page.tsx");
    const settingsActions = read("src/app/settings/actions.ts");
    const profileTabs = read("src/app/profile/profile-section-tabs.tsx");
    const profile = read("src/app/(app)/profile/page.tsx");
    const progress = read("src/app/(app)/progress/page.tsx");

    expect(bag).toContain("defaultValue={activeTab}");
    expect(bag).toContain('id="bag-gapping-table"');
    expect(bag).toContain('id="club-evolution"');
    expect(providers).toContain("defaultValue={activeTab}");
    expect(providers).toContain('href: "/providers?tab=diagnostics#provider-jobs"');
    expect(settings.match(/href: "\/settings\?section=sharing#sharing-settings"/g)).toHaveLength(3);
    expect(coach).toContain("defaultTab={activeWorkbenchTab}");
    expect(coach).toContain('href: "/coach?tab=evidence#coach-evidence-ledger"');
    expect(courseHoles).toContain("defaultValue={activeTab}");
    expect(courseHoles).toContain('href: "?tab=tees#tee-set"');
    expect(courseHoles).toContain("activeHoleGeometrySuggestedViews");
    expect(courseHoles).toContain('view.href.includes("tab=holes")');
    expect(dashboard).toContain('href="/bag?tab=fitting"');
    expect(dashboard).not.toContain("/bag?tab=fitting#wedge-roles");
    expect(equipment).toContain("equipmentSuggestedViews(includeRetiredClubs)");
    expect(equipment).toContain("includeRetiredClubs={data.retiredClubs.length > 0}");
    expect(handicap).toContain('href: "#rounds-mobile"');
    expect(handicap).toContain('id="rounds-mobile"');
    expect(handicap).toContain("missingRatingRounds.length > 0");
    expect(settingsActions).toContain(
      'redirect("/settings?section=danger&resetError=confirmation#danger-zone")',
    );
    expect(settingsActions).toContain('redirect("/settings?section=danger&reset=1#danger-zone")');
    expect(profileTabs).toContain('{ value: "workspaces", label: "Workspaces" }');
    expect(profile).toContain('id="workspaces"');
    expect(profile).toContain("Your golf workspaces");
    expect(progress).toContain('href: "/progress#bag-movement"');
    expect(progress).toContain('id="bag-movement"');
  });

  it("rejects the retired dead fragment destinations", () => {
    const routeSources = [
      "src/app/(app)/bag/page.tsx",
      "src/app/(app)/dashboard/page.tsx",
      "src/app/(app)/progress/page.tsx",
      "src/app/(app)/providers/page.tsx",
      "src/app/(admin)/admin/system-checks/page.tsx",
      "src/app/(app)/settings/page.tsx",
      "src/app/(app)/coach/page.tsx",
      "src/app/(app)/challenges/page.tsx",
      "src/app/(app)/strokes-gained/page.tsx",
      "src/app/import/shot-preview.tsx",
      "src/app/data-chat/data-chat-panel.tsx",
    ]
      .map(read)
      .join("\n");

    for (const retiredTarget of [
      "/bag#reference-data",
      "/bag#bag-trust",
      "/bag#bag-gapping-table",
      "/bag#wedge-roles",
      "/providers#provider-health",
      "/providers#provider-jobs",
      "/settings#sharing-settings",
      "/settings#offline-storage",
      "/coach#coach-evidence-ledger",
      "/coach#more-drills",
      "/import#files",
      "#from-my-data",
    ]) {
      expect(routeSources).not.toContain(retiredTarget);
    }
  });
});
