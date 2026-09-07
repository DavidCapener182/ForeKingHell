import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/settings/page.tsx"), "utf8");
const workspaceSource = readFileSync(
  join(process.cwd(), "src/app/settings/settings-workspace.tsx"),
  "utf8",
);
const workspaceCss = readFileSync(
  join(process.cwd(), "src/app/settings/settings-workspace.module.css"),
  "utf8",
);
const dirtyFormSource = readFileSync(
  join(process.cwd(), "src/app/settings/settings-dirty-form.tsx"),
  "utf8",
);
const sectionsSource = readFileSync(join(process.cwd(), "src/lib/settings-sections.ts"), "utf8");
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
      const index = sectionsSource.indexOf(`label: \"${label}\"`);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }

    expect(source).toContain("items={settingsSections.map");
    expect(workspaceSource).toContain('aria-label="Settings sections"');
    expect(workspaceSource).toContain('aria-current={active === i.id ? "page" : undefined}');
    expect(workspaceSource).toContain('url.searchParams.set("section", key)');
    expect(workspaceSource).toContain('window.addEventListener("popstate", sync)');
  });

  it("uses a mobile index while retaining mounted section drafts", () => {
    expect(source).toContain("<SettingsWorkspace");
    expect(source).toContain(
      "initialSection={isSettingsSection(params?.section) ? activeSection : null}",
    );
    expect(workspaceSource).toContain("All settings sections");
    expect(workspaceSource).toContain("{items.map((i) => (");
    expect(workspaceSource).toContain('style={{ display: active === i.id ? "block" : "none" }}');
    expect(workspaceCss).toContain("@media (max-width: 1023px)");
    expect(workspaceCss).toContain('.workspace[data-has-selection="true"] > .navigation');
    expect(source).toContain("switch (activeSection)");
  });

  it("groups controls with whitespace and dividers instead of cards per input", () => {
    expect(source).toContain("function SettingsGroup");
    expect(source).toContain('className="divide-y divide-border"');
    expect(source).not.toContain('from "@/components/ui/card"');
    expect(source).not.toContain("<Card");
  });
});

describe("settings save and error feedback", () => {
  it("uses dirty forms with retained errors and accessible save feedback", () => {
    expect(source.match(/<SettingsDirtyForm/g)?.length).toBeGreaterThanOrEqual(4);
    expect(dirtyFormSource).toContain('<p role="status">Settings saved.</p>');
    expect(dirtyFormSource).toContain('role="alert"');
    expect(dirtyFormSource).toContain("Your draft is retained.");
    expect(dirtyFormSource).toContain("if (lock.current) return;");
    expect(dirtyFormSource).toContain("disabled={pending || !ready}");
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
    expect(source).toContain("These actions cannot be undone");
    expect(source).toContain("confirmTitle={`Reset golf data for ${profile.email");
    expect(source).toContain("confirmTitle={`Delete ${profile.email");
    expect(source).toContain('label="Type RESET to confirm"');
    expect(source).toContain("label={`Type ${profile.email ?? profile.id} to confirm`}");
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
