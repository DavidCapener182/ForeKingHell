import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/profile/page.tsx"), "utf8");
const tabsSource = readFileSync(
  join(process.cwd(), "src/app/profile/profile-section-tabs.tsx"),
  "utf8",
);
const profileHeaderPath = join(process.cwd(), "src/app/profile/profile-header.tsx");

describe("profile mobile real-data contract", () => {
  it("does not invent a session count or draw fixed progress artwork", () => {
    expect(source).not.toContain("trackedCleanShots / 120");
    expect(source).not.toContain("#0B7A3B_0_18%");
    expect(source).not.toContain("cleanShotPercentage");
    expect(source).not.toContain('aria-label="Clean shot coverage"');
  });

  it("removes mini workspaces from companion profile and keeps focused controls", () => {
    const controls = source.indexOf('title="Profile controls"');

    expect(controls).toBeGreaterThan(0);
    expect(source).not.toContain("<MobileTabBar");
    expect(source).not.toContain("<PBCard");
    expect(source).not.toContain("<ProgressCard");
    expect(source).not.toContain("<DataHealthFeaturePanel");
    expect(source).not.toContain("<ProfileFeaturePanel");
    expect(source).not.toContain("getProgressData");
    expect(source).not.toContain("getFeatureIdeasData");
    expect(source).toContain('title="Golf workspaces"');
    expect(source).toContain('href="/progress"');
    expect(source).toContain('href="/bag"');
    expect(source).toContain('href="/goals"');
    expect(source).not.toContain('title="Season plan"');
    expect(source).not.toContain('title="Bag"');
    expect(source).not.toContain('title="Activity"');
    expect(source).not.toContain('title="This week"');
    expect(source).toContain('value: "sharing"');
    expect(source).not.toContain('value: "data-health"');
    expect(source).toContain("IOSDisclosureGroup");
  });

  it("loads challenge and honours evidence only for the desktop workbench", () => {
    expect(source).toContain('surface === "workbench"');
    expect(source).toContain(
      "await Promise.all([getChallengesPageData(), getProfileHonoursData(profile.userId)])",
    );
    expect(source).toContain("DesktopWorkbenchLayout && challenges && honours");
    expect(source).not.toContain('className="hidden lg:contents"');
  });

  it("composes the identity surface directly from Card primitives", () => {
    expect(source).not.toContain("ProfileHeader");
    expect(source).toContain('<Card className="gap-0 overflow-hidden">');
    expect(source).toContain('<CardContent className="grid gap-4 p-5 pt-1">');
    expect(existsSync(profileHeaderPath)).toBe(false);
  });

  it("labels and targets the profile workspace section consistently", () => {
    expect(tabsSource).toContain('{ value: "workspaces", label: "Workspaces" }');
    expect(tabsSource).toContain('hash === "workspaces"');
    expect(tabsSource).not.toContain('value: "achievements"');
    expect(tabsSource).not.toContain('hash === "achievements"');
    expect(source).toContain('<Card id="workspaces" className="scroll-mt-28">');
    expect(source).not.toContain('id="achievements"');
  });
});
