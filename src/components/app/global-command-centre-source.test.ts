import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/app/app-command-menu.tsx"), "utf8");
const trigger = readFileSync(
  join(process.cwd(), "src/components/app/app-command-trigger.tsx"),
  "utf8",
);
const compatibilityExport = readFileSync(
  join(process.cwd(), "src/components/app/global-command-centre.tsx"),
  "utf8",
);

describe("global command centre contract", () => {
  it("uses central metadata and official command composition for every entrypoint", () => {
    expect(source).toContain('desktop-workbench-chrome');
    expect(source).toContain('commandOnly');
    expect(source).not.toContain('function buildCommandItems');
    const shared = readFileSync(join(process.cwd(), 'src/components/app/desktop-workbench-chrome.tsx'), 'utf8');
    expect(shared).toContain('commandRoutes(isAdmin)');
    expect(shared).toContain('/api/desktop-workbench/commands');
    expect(shared).toContain('workspaceCommandsError');
    expect(shared).toContain('enableKeyboardShortcut');
    expect(trigger).toContain("AppCommandTrigger");
    expect(trigger).toContain("Command K or Ctrl K");
    expect(compatibilityExport).toContain("AppCommandMenu as GlobalCommandCentre");
  });
});
