import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("desktop workbench decomposition", () => {
  it("keeps notification state and workspace switching outside the chrome orchestrator", () => {
    const chrome = readFileSync(
      join(root, "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );

    expect(existsSync(join(root, "src/components/app/workbench/notification-centre.tsx"))).toBe(
      true,
    );
    expect(existsSync(join(root, "src/components/app/workbench/workspace-switcher.tsx"))).toBe(
      true,
    );
    expect(chrome).toContain("import { NotificationCentre } from");
    expect(chrome).toContain("import { WorkspaceSwitcher } from");
    expect(chrome).not.toContain("function normalizeNotificationItem");
    expect(chrome).not.toContain("function getWorkspaceViews");
  });
});
