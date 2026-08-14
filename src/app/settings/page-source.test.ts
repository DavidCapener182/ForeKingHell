import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/settings/page.tsx"), "utf8");
const actionsSource = readFileSync(join(process.cwd(), "src/app/settings/actions.ts"), "utf8");
const notificationActionsSource = readFileSync(
  join(process.cwd(), "src/app/settings/notifications/actions.ts"),
  "utf8",
);

describe("settings information architecture", () => {
  it("provides the requested desktop section navigation in order", () => {
    const labels = [
      "General",
      "Appearance",
      "Privacy",
      "Sharing",
      "Notifications",
      "Connected Data",
      "Offline",
      "Billing",
      "Danger Zone",
    ];

    let previousIndex = -1;
    for (const label of labels) {
      const index = source.indexOf(`label: \"${label}\"`);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }

    expect(source).toContain("data-settings-section-navigation");
    expect(source).toContain('aria-current={active ? "page" : undefined}');
    expect(source).toContain("href={`/settings?section=${section.value}`}");
    expect(source).toContain('className="mt-4 border-t border-border pt-4"');
  });

  it("uses a mobile settings index and drills into one selected section", () => {
    expect(source).toContain('surface === "companion" && !hasSelectedMobileSection');
    expect(source).toContain("<MobileSettingsIndex");
    expect(source).toContain('href="/settings?section=general"');
    expect(source).toContain('href="/settings?section=appearance"');
    expect(source).toContain('href="/settings?section=privacy"');
    expect(source).toContain('href="/settings?section=sharing"');
    expect(source).toContain('href="/settings?section=notifications"');
    expect(source).toContain('href="/settings?section=data"');
    expect(source).toContain('href="/settings?section=offline"');
    expect(source).toContain('href="/settings?section=billing"');
    expect(source).toContain('href="/settings?section=danger"');
    expect(source).toContain("switch (activeSection)");
    expect(source).not.toContain("SettingsMobileDisclosure");
  });

  it("groups controls with whitespace and dividers instead of cards per input", () => {
    expect(source).toContain("function SettingsGroup");
    expect(source).toContain('className="divide-y divide-border"');
    expect(source).not.toContain('from "@/components/ui/card"');
    expect(source).not.toContain("<Card");
  });
});

describe("settings save and error feedback", () => {
  it("uses dirty forms for editable sections and a toast for successful saves", () => {
    expect(source.match(/<SettingsDirtyForm/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source).toContain("<SettingsStatusToast");
    expect(source).toContain('name="settingsSection" value="general"');
    expect(source).toContain('name="settingsSection" value="appearance"');
    expect(source).toContain('name="settingsSection" value="privacy"');
    expect(source).toContain('name="settingsReturnTo" value="section"');
  });

  it("saves each profile section without resetting fields owned by another section", () => {
    expect(actionsSource).toContain('section === "appearance"');
    expect(actionsSource).toContain('section === "privacy"');
    expect(actionsSource).toContain('settingsFormSection(formData.get("settingsSection"))');
    expect(actionsSource).toContain("redirect(`/settings?section=${section}&saved=1`)");
    expect(notificationActionsSource).toContain('formData.get("settingsReturnTo") === "section"');
    expect(notificationActionsSource).toContain('"/settings?section=notifications&saved=1"');
  });

  it("renders action errors as inline Alerts", () => {
    expect(source).toContain('<Alert variant="destructive">');
    expect(source).toContain("<AlertTitle>Deletion was not run</AlertTitle>");
    expect(source).toContain("<AlertTitle>Reset was not run</AlertTitle>");
    expect(source).toContain("<AlertTitle>Invite not completed</AlertTitle>");
  });
});

describe("settings danger zone", () => {
  it("is strongly separated and requires AlertDialog-backed confirmation", () => {
    expect(source).toContain('id="danger-zone"');
    expect(source).toContain("border-destructive/45");
    expect(source).toContain('confirmTitle="Reset all golf data?"');
    expect(source).toContain('confirmTitle="Delete this account permanently?"');
    expect(source).toContain("<ConfirmSubmitButton");
  });

  it("returns recoverable destructive outcomes to the danger section", () => {
    expect(actionsSource).toContain(
      'redirect("/settings?section=danger&deleteError=confirmation#danger-zone")',
    );
    expect(actionsSource).toContain(
      'redirect("/settings?section=danger&resetError=confirmation#danger-zone")',
    );
    expect(actionsSource).toContain('redirect("/settings?section=danger&reset=1#danger-zone")');
  });
});
