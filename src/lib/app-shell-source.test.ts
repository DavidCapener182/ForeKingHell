import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("app shell account data", () => {
  it("does not timeout authenticated sidebar identity to fake level 1 XP", () => {
    const source = readFileSync(join(root, "src/app/(app)/layout.tsx"), "utf8");

    expect(source).toContain("Promise.all([getAppShellData(), getRequestAppSurface()])");
    expect(source).not.toContain("getAppShellDataWithTimeout");
    expect(source).not.toContain("Promise.race");
    expect(source).not.toContain("appShellDataTimeoutMs");
  });

  it("repairs and sanitizes authenticated profile labels before rendering the shell", () => {
    const source = readFileSync(join(root, "src/lib/app-shell-data.ts"), "utf8");

    expect(source).toContain("await ensureUserProfile(user);");
    expect(source).toContain("cleanProfileLabel(accountRow?.displayName)");
    expect(source).toContain("profileLabelFromIdentity(user.name, user.email)");
    expect(source).not.toContain("fallbackProfileLabel");
  });

  it("keeps local auth bypass connected to canonical account data when the database is configured", () => {
    const layoutSource = readFileSync(join(root, "src/lib/app-shell-data.ts"), "utf8");
    const currentUserSource = readFileSync(join(root, "src/lib/current-user.ts"), "utf8");

    expect(layoutSource).not.toContain("isPlaywrightE2eAuthBypassEnabled");
    expect(currentUserSource).toContain("await ensureUserProfile(authUser);");
    expect(currentUserSource).toContain("return resolveLinkedCurrentUser(authUser);");
    expect(currentUserSource).not.toContain(
      "!process.env.DATABASE_URL?.trim() || isPlaywrightE2eAuthBypassEnabled()",
    );
  });

  it("keeps desktop accessibility and table keyboard affordances in the app shell", () => {
    const source = readFileSync(join(root, "src/components/app/workbench-app-shell.tsx"), "utf8");

    expect(source).toContain('href="#main-content"');
    expect(source).toContain("Skip to content");
    expect(source).toContain('href="#app-sidebar"');
    expect(source).toContain("Skip to sidebar");
    expect(source).toContain("<MainTableSkipLink pathname={pathname} />");
    expect(source).toContain("Skip to main table");
    expect(source).toContain("function focusMainTableTarget(target: HTMLElement | null)");
    expect(source).toContain('if (!target.hasAttribute("tabindex"))');
    expect(source).toContain("target.tabIndex = -1");
    expect(source).toContain("target.focus({ preventScroll: true })");
    expect(source).toContain('target.scrollIntoView({ block: "start" })');
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
    expect(source).toContain('type SidebarDensity = "comfortable" | "compact" | "icon"');
    expect(source).toContain(
      'density === "compact" ? "Compact" : density === "icon" ? "Icon-only" : "Comfortable"',
    );
    expect(source).toContain("aria-label={`Sidebar density: ${densityLabel}`}");
    expect(source).toContain('<DropdownMenuRadioItem value="comfortable">');
    expect(source).toContain('<DropdownMenuRadioItem value="compact">');
    expect(source).toContain('<DropdownMenuRadioItem value="icon">');
    expect(source).toContain("data-phone-companion-return");
    expect(source).toContain("Return to companion");
    expect(source).toContain("/surface/companion?next=%2Ftoday");
    expect(source).toContain("<AppSurfaceLink");
    expect(source).toContain("max-md:inline-flex");
    expect(source).toContain('event.key !== "ArrowDown"');
    expect(source).toContain('event.key !== "ArrowUp"');
    expect(source).toContain('event.key !== "Home"');
    expect(source).toContain('event.key !== "End"');
    expect(source).toContain('if (key === "ArrowDown")');
    expect(source).toContain('if (key === "ArrowUp")');
    expect(source).toContain('if (key === "Home")');
    expect(source).toContain('if (key === "End")');
    expect(source).not.toContain("SunlightModeButton");
    expect(source).not.toContain("fkh:sunlight-mode");
  });

  it("boots the stored theme before paint and delegates live changes to one controller", () => {
    const layoutSource = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
    const privateShellSource = readFileSync(
      join(root, "src/components/app/private-app-shell.tsx"),
      "utf8",
    );
    const bootstrapSource = readFileSync(
      join(root, "src/components/theme-bootstrap-script.tsx"),
      "utf8",
    );
    const dataSource = readFileSync(join(root, "src/lib/app-shell-data.ts"), "utf8");
    const controllerSource = readFileSync(
      join(root, "src/components/theme-controller.tsx"),
      "utf8",
    );

    expect(layoutSource).toContain("<head>");
    expect(bootstrapSource).toContain("dangerouslySetInnerHTML={{ __html: script }}");
    expect(bootstrapSource).not.toContain('strategy="beforeInteractive"');
    expect(layoutSource).toContain("data-theme-preference={publicPreferences.theme}");
    expect(privateShellSource).toContain("preference={data.preferences.theme}");
    expect(dataSource).toContain("theme: users.theme");
    expect(controllerSource).toContain('window.matchMedia("(prefers-color-scheme: dark)")');
    expect(controllerSource).toContain(
      'colourScheme.addEventListener("change", handleSystemChange)',
    );
    expect(controllerSource).toContain(
      'mobileViewport.addEventListener("change", handleViewportChange)',
    );
    expect(controllerSource).toContain('if (mobileViewport.matches || preference === "system")');
    expect(controllerSource).toContain('theme === "range-night"');
    expect(controllerSource).toContain('root.classList.toggle("dark", usesDarkColourScheme)');
  });
});
