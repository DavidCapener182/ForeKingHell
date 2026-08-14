import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/profile/page.tsx"), "utf8");
const tabsSource = readFileSync(
  join(process.cwd(), "src/app/profile/profile-section-tabs.tsx"),
  "utf8",
);
const editSheetSource = readFileSync(
  join(process.cwd(), "src/app/profile/profile-edit-sheet.tsx"),
  "utf8",
);

describe("profile golf identity contract", () => {
  it("keeps the page identity-first on both app surfaces", () => {
    expect(source).toContain("data-profile-identity-page");
    expect(source).toContain("<ProfileIdentityHero");
    expect(source).toContain('aria-label="Golf identity"');
    expect(source).toContain("<MobileAppShell>{experience}</MobileAppShell>");
    expect(source).toContain(
      '<DesktopWorkbenchLayout scope="profile">{experience}</DesktopWorkbenchLayout>',
    );
    expect(source).toContain("profile.headerImageUrl");
    expect(source).toContain("profile.avatarUrl");
  });

  it("uses exactly the requested profile tabs", () => {
    for (const [value, label] of [
      ["overview", "Overview"],
      ["achievements", "Achievements"],
      ["records", "Records"],
      ["sharing", "Sharing"],
    ]) {
      expect(tabsSource).toContain(`{ value: "${value}", label: "${label}" }`);
      expect(tabsSource).toContain(`<TabsContent value="${value}"`);
    }

    expect(tabsSource).not.toContain("workspaces");
  });

  it("keeps overview concise and avoids embedded Bag, Progress, and Goals dashboards", () => {
    expect(source).toContain("Short golf profile");
    expect(source).toContain("Recent highlight");
    expect(source).toContain("Current handicap");
    expect(source).toContain("Favourite / home course");
    expect(source).toContain("Launch monitor");
    expect(source).toContain("Recent meaningful activity");
    expect(source).not.toContain("Your golf workspaces");
    expect(source).not.toContain('href="/progress"');
    expect(source).not.toContain('href="/bag"');
    expect(source).not.toContain('href="/goals"');
  });

  it("uses real achievements, course records, PBs, and self-visible activity", () => {
    expect(source).toContain("getAchievementPageData(profile.userId)");
    expect(source).toContain("getProfileHonoursData(profile.userId)");
    expect(source).toContain("getProfilePageData(profile.username)");
    expect(source).toContain("selectProfileAchievements(achievements.achievements)");
    expect(source).toContain("records={honours.records}");
    expect(source).toContain("launchRecords={profile.pbShowcaseJson}");
    expect(source).not.toContain("trackedCleanShots / 120");
    expect(source).not.toContain("cleanShotPercentage");
  });

  it("keeps visibility, QR, coach scope, friend scope, and editing in a sheet", () => {
    expect(source).toContain("Profile visibility");
    expect(source).toContain("Coach sharing");
    expect(source).toContain("Friend scope");
    expect(source).toContain("Share link");
    expect(source).toContain("src={`/friends/qr/${profile.username}`}");
    expect(source).toContain("<ProfileEditSheet>");
    expect(editSheetSource).toContain("<Sheet>");
    expect(editSheetSource).toContain("Edit profile");
  });
});
