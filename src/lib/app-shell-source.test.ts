import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("app shell account data", () => {
  it("does not timeout authenticated sidebar identity to fake level 1 XP", () => {
    const source = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

    expect(source).toContain("await getAppShellData()");
    expect(source).not.toContain("getAppShellDataWithTimeout");
    expect(source).not.toContain("Promise.race");
    expect(source).not.toContain("appShellDataTimeoutMs");
  });

  it("repairs and sanitizes authenticated profile labels before rendering the shell", () => {
    const source = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

    expect(source).toContain("await ensureUserProfile(user);");
    expect(source).toContain("cleanProfileLabel(accountRow?.displayName)");
    expect(source).toContain("profileLabelFromIdentity(user.name, user.email)");
    expect(source).not.toContain("fallbackProfileLabel");
  });

  it("keeps local auth bypass connected to canonical account data when the database is configured", () => {
    const layoutSource = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
    const currentUserSource = readFileSync(join(root, "src/lib/current-user.ts"), "utf8");

    expect(layoutSource).not.toContain("isPlaywrightE2eAuthBypassEnabled");
    expect(currentUserSource).toContain("await ensureUserProfile(authUser);");
    expect(currentUserSource).toContain("return resolveLinkedCurrentUser(authUser);");
    expect(currentUserSource).not.toContain(
      "!process.env.DATABASE_URL?.trim() || isPlaywrightE2eAuthBypassEnabled()",
    );
  });

  it("keeps desktop accessibility and table keyboard affordances in the app shell", () => {
    const source = readFileSync(join(root, "src/components/app/app-shell.tsx"), "utf8");

    expect(source).toContain('href="#main-content"');
    expect(source).toContain("Skip to content");
    expect(source).toContain('href="#app-sidebar"');
    expect(source).toContain("Skip to sidebar");
    expect(source).toContain("<MainTableSkipLink pathname={pathname} />");
    expect(source).toContain("Skip to main table");
    expect(source).toContain("function resolveMainTableTarget()");
    expect(source).toContain(
      "document.querySelector<HTMLElement>(\"[data-main-table-target='true']\")",
    );
    expect(source).toContain(
      'document.querySelector<HTMLElement>("table[data-workbench-export-table]")',
    );
    expect(source).toContain("[data-slot='table-container'], [role='region']");
    expect(source).toContain('row.closest("table[data-workbench-export-table]")');
    expect(source).toContain("window.localStorage.getItem(sidebarDensityStorageKey)");
    expect(source).toContain("window.localStorage.setItem(sidebarDensityStorageKey, nextDensity)");
    expect(source).toContain("data-sidebar-density={sidebarDensity}");
    expect(source).toContain('event.key !== "ArrowDown"');
    expect(source).toContain('event.key !== "ArrowUp"');
    expect(source).toContain('event.key !== "Home"');
    expect(source).toContain('event.key !== "End"');
    expect(source).toContain('if (key === "ArrowDown")');
    expect(source).toContain('if (key === "ArrowUp")');
    expect(source).toContain('if (key === "Home")');
    expect(source).toContain('if (key === "End")');
    expect(source).toContain("const [enabled, setEnabled] = useState(false)");
    expect(source).toContain('window.localStorage.getItem("fkh:sunlight-mode") === "true"');
  });
});
