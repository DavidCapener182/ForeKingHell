import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { defaultThemePreference, parseTheme } from "@/lib/user-settings";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("Clubhouse Manager default theme contract", () => {
  it("uses Clubhouse Manager for missing and malformed preferences", () => {
    expect(defaultThemePreference).toBe("clubhouse");
    expect(parseTheme(null)).toBe("clubhouse");
    expect(parseTheme("unknown-theme")).toBe("clubhouse");
  });

  it("keeps the server-rendered shell and client fallback on Clubhouse Manager", () => {
    const layout = source("src/app/layout.tsx");
    const controller = source("src/components/theme-controller.tsx");
    const bootstrap = source("src/components/theme-bootstrap-script.tsx");
    const appShellData = source("src/lib/app-shell-data.ts");
    const currentUser = source("src/lib/current-user.ts");

    expect(layout).toContain("theme: defaultThemePreference");
    expect(layout).toContain("data-theme={publicPreferences.theme}");
    expect(layout).toContain(
      '{ media: "(min-width: 1024px)", color: themeColourByMode.clubhouse }',
    );
    expect(controller).toContain(
      "return isThemePreference(value) ? value : defaultThemePreference;",
    );
    expect(bootstrap).toContain('window.location.pathname === "/settings"');
    expect(bootstrap).toContain("sessionStorage.removeItem(themePreviewStorageKey)");
    expect(appShellData).toContain("theme: defaultThemePreference");
    expect(currentUser).toContain("theme: defaultThemePreference");
  });

  it("defaults new accounts and migrates the old system default without replacing named themes", () => {
    const schema = source("src/db/schema.ts");
    const migration = source("drizzle/0054_clubhouse_manager_default.sql");

    expect(schema).toContain('default("clubhouse")');
    expect(migration).toContain(`ALTER COLUMN "theme" SET DEFAULT 'clubhouse'`);
    expect(migration).toContain(`WHERE "theme" = 'system'`);
    expect(migration).not.toMatch(/WHERE\\s+"theme"\\s+IN/i);
  });
});
