import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop workbench chrome source", () => {
  it("keeps the optional AI assistant available on analytical workbench routes", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );
    const prefixBlock =
      source.match(/const assistantSupportedRoutePrefixes = \[[\s\S]*?\];/)?.[0] ?? "";

    for (const route of [
      "/today",
      "/shots",
      "/bag",
      "/courses",
      "/course-records",
      "/rounds",
      "/compare",
      "/progress",
      "/strokes-gained",
      "/coach",
      "/data-chat",
      "/admin",
    ]) {
      expect(prefixBlock).toContain(`"${route}"`);
    }

    expect(prefixBlock).not.toContain('"/dashboard"');
    expect(prefixBlock).not.toContain('"/feed"');
    expect(prefixBlock).not.toContain('"/friends"');
    expect(prefixBlock).not.toContain('"/groups"');
    expect(prefixBlock).not.toContain('"/leaderboard"');
    expect(prefixBlock).not.toContain('"/profile"');
    expect(prefixBlock).not.toContain('"/settings"');
    expect(prefixBlock).not.toContain('"/practice"');
    expect(prefixBlock).not.toContain('"/speed"');
    expect(prefixBlock).not.toContain('"/stats/training-over-time"');
    expect(prefixBlock).not.toContain('"/equipment"');
    expect(prefixBlock).not.toContain('"/handicap"');
    expect(prefixBlock).not.toContain('"/import"');
    expect(prefixBlock).not.toContain('"/rapsodo"');
    expect(prefixBlock).not.toContain('"/providers"');
    expect(prefixBlock).not.toContain('"/simulator-lab"');
    expect(prefixBlock).not.toContain('"/billing"');
    expect(prefixBlock).not.toContain('"/partners"');
    expect(prefixBlock).not.toContain('"/social-intelligence"');
    expect(prefixBlock).not.toContain('"/achievements"');
    expect(prefixBlock).not.toContain('"/challenges"');
    expect(prefixBlock).not.toContain('"/tournaments"');
  });

  it("labels deep desktop breadcrumbs for workbench detail routes", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );

    expect(source).toContain('return "Club analytics"');
    expect(source).toContain('return "Round review"');
    expect(source).toContain('return "Hole management"');
    expect(source).toContain('return "Event leaderboard"');
  });

  it("keeps desktop primary actions route-aware instead of falling back to import", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );
    const primaryActionBlock =
      source.match(/function getPrimaryAction[\s\S]*?\n}\n\nfunction getAssistantContext/)?.[0] ??
      "";

    for (const expected of [
      'pathname.startsWith("/dashboard")',
      'label: "Latest practice"',
      'href: "/today"',
      "icon: CalendarDays",
      'pathname.startsWith("/feed")',
      'label: "Friends"',
      'href: "/friends"',
      "icon: Users",
      'pathname.startsWith("/settings")',
      'label: "Billing"',
      'href: "/billing"',
      "icon: CreditCard",
      'pathname.startsWith("/admin")',
      'label: "User lookup"',
      'href: "/admin/users"',
      "icon: UserRound",
      'label: "Dashboard"',
      "icon: Gauge",
    ]) {
      expect(primaryActionBlock).toContain(expected);
    }

    expect(primaryActionBlock).toContain('pathname.startsWith("/today")');
    expect(primaryActionBlock).toContain('label: "Shot rows"');
    expect(primaryActionBlock).toContain('href: "/shots"');
    expect(primaryActionBlock).toContain("icon: Database");
  });

  it("keeps excluded routes out of the assistant context resolver", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );
    const contextBlock =
      source.match(/function getAssistantContext[\s\S]*?\n}\n\nfunction assistantContext/)?.[0] ??
      "";

    for (const route of [
      "/dashboard",
      "/practice",
      "/speed",
      "/stats/training-over-time",
      "/equipment",
      "/handicap",
      "/simulator-lab",
      "/import",
      "/rapsodo",
      "/providers",
      "/settings",
      "/billing",
      "/partners",
      "/feed",
      "/friends",
      "/groups",
      "/profile",
      "/social-intelligence",
      "/achievements",
      "/challenges",
      "/tournaments",
      "/leaderboard",
    ]) {
      expect(contextBlock).not.toContain(`pathname.startsWith("${route}")`);
    }

    for (const route of [
      "/today",
      "/shots",
      "/compare",
      "/bag",
      "/rounds",
      "/courses",
      "/course-records",
      "/progress",
      "/strokes-gained",
      "/coach",
      "/data-chat",
      "/admin",
    ]) {
      expect(contextBlock).toContain(`pathname.startsWith("${route}")`);
    }

    expect(contextBlock).toContain('label: "Latest practice"');
    expect(contextBlock).toContain("Clean scoring summary");
    expect(contextBlock).toContain("Raw shot rows and quality tags");
    expect(contextBlock).toContain('label: "Build latest-practice plan"');
    expect(contextBlock).toContain('label: "Generate session report"');
  });

  it("closes the assistant sheet when navigating to unsupported pages", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );

    expect(source).toContain("if (!assistantContext && assistantOpen)");
    expect(source).toContain("window.setTimeout(() => setAssistantOpen(false), 0)");
    expect(source).toContain(
      "const assistantSheetOpen = assistantOpen && Boolean(assistantContext)",
    );
    expect(source).toContain("setAssistantOpen(false)");
    expect(source).toContain("[assistantContext, assistantOpen]");
    expect(source).toContain("<Sheet open={assistantSheetOpen}");
  });

  it("uses club-specific assistant contexts for bag detail routes", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );
    const contextBlock =
      source.match(/function getAssistantContext[\s\S]*?\n}\n\nfunction assistantContext/)?.[0] ??
      "";

    expect(contextBlock).toContain("/^\\/bag\\/[^/]+\\/analytics$/.test(pathname)");
    expect(contextBlock).toContain('label: "Club analytics"');
    expect(contextBlock).toContain("/^\\/bag\\/[^/]+$/.test(pathname)");
    expect(contextBlock).toContain('pathname !== "/bag/longest"');
    expect(contextBlock).toContain('label: "Club profile"');
    expect(contextBlock.indexOf('label: "Club analytics"')).toBeLessThan(
      contextBlock.indexOf('label: "Bag"'),
    );
    expect(contextBlock.indexOf('label: "Club profile"')).toBeLessThan(
      contextBlock.indexOf('label: "Bag"'),
    );
  });

  it("refreshes command-palette saved insights after rail saves", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'import { savedInsightUpdatedEvent } from "@/components/app/desktop-save-insight-button";',
    );
    expect(source).toContain("window.addEventListener(savedInsightUpdatedEvent");
    expect(source).toContain("setSavedInsightLinks(readStoredLinks(savedInsightStorageKey))");
    expect(source).toContain("window.removeEventListener(savedInsightUpdatedEvent");
  });

  it("refreshes command-palette saved views after table view changes", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'import { desktopSavedViewsUpdatedEvent } from "@/components/app/desktop-workbench-controls";',
    );
    expect(source).toContain(
      "const syncSavedViews = () => setSavedViewCommands(readSavedViewCommands())",
    );
    expect(source).toContain("window.addEventListener(desktopSavedViewsUpdatedEvent");
    expect(source).toContain("window.removeEventListener(desktopSavedViewsUpdatedEvent");
  });

  it("keeps the desktop workspace switcher role-aware", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );
    const switcherBlock =
      source.match(/function WorkspaceSwitcher[\s\S]*?function NotificationRow/)?.[0] ?? "";
    const viewsBlock =
      source.match(/function getWorkspaceViews[\s\S]*?function NotificationRow/)?.[0] ?? "";

    expect(switcherBlock).toContain('aria-label="Switch workspace view"');
    expect(switcherBlock).toContain("<DropdownMenuLabel>Workspace view</DropdownMenuLabel>");
    expect(viewsBlock).toContain('label: "Player workspace"');
    expect(viewsBlock).toContain('href: "/dashboard"');
    expect(viewsBlock).toContain('label: "Coach desk"');
    expect(viewsBlock).toContain('href: "/coach"');
    expect(viewsBlock).toContain('pathname.startsWith("/practice")');
    expect(viewsBlock).toContain('pathname.startsWith("/data-chat")');
    expect(viewsBlock).toContain("...(isAdmin");
    expect(viewsBlock).toContain('label: "Admin console"');
    expect(viewsBlock).toContain('href: "/admin"');
    expect(viewsBlock).toContain('pathname.startsWith("/partners")');
    expect(source).toContain('href: "/admin/system-checks"');
  });

  it("keeps desktop keyboard shortcuts discoverable and wired to implemented handlers", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );
    const shortcutRowsBlock = source.match(/const shortcutRows = \[[\s\S]*?\];/)?.[0] ?? "";
    const keydownBlock =
      source.match(
        /function handleKeyDown\(event: KeyboardEvent\)[\s\S]*?window.addEventListener/,
      )?.[0] ?? "";
    const shortcutRoutesBlock =
      source.match(/const shortcutRoutes = new Map\(\[[\s\S]*?\]\);/)?.[0] ?? "";
    const dialogBlock = source.match(/<Dialog open={shortcutsOpen}[\s\S]*?<\/Dialog>/)?.[0] ?? "";

    for (const shortcut of [
      "Open command palette",
      "Dashboard",
      "Latest practice",
      "Progress",
      "Bag",
      "Shots",
      "Rounds",
      "Coach",
      "Data Chat",
      "Focus page search or filter",
      "Focus filters",
      "Export current view",
      "Open workspace links",
      "Open AI assistant on supported pages",
      "Select focused table row",
      "Move between table rows",
      "Keyboard shortcuts",
    ]) {
      expect(shortcutRowsBlock).toContain(shortcut);
    }

    expect(keydownBlock).toContain('(event.metaKey || event.ctrlKey) && key === "k"');
    expect(keydownBlock).toContain('event.key === "?"');
    expect(keydownBlock).toContain('key === "w"');
    expect(keydownBlock).toContain('key === "a" && assistantContext');
    expect(keydownBlock).toContain('key === "/"');
    expect(keydownBlock).toContain('key === "f"');
    expect(keydownBlock).toContain('key === "e"');
    expect(keydownBlock).toContain('key === "g"');

    for (const route of [
      '["d", "/dashboard"]',
      '["t", "/today"]',
      '["p", "/progress"]',
      '["b", "/bag"]',
      '["s", "/shots"]',
      '["r", "/rounds"]',
      '["c", "/coach"]',
      '["h", "/data-chat"]',
    ]) {
      expect(shortcutRoutesBlock).toContain(route);
    }

    expect(dialogBlock).toContain("<DialogTitle>Keyboard shortcuts</DialogTitle>");
    expect(dialogBlock).toContain("shortcutRows.map");
    expect(dialogBlock).toContain("<ShortcutKey");
  });

  it("exposes command-palette results as a keyboard-readable listbox", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );
    const dialogBlock =
      source.match(/<Dialog open={commandOpen}[\s\S]*?<Sheet open={assistantSheetOpen}/)?.[0] ?? "";
    const commandLinkBlock =
      source.match(/function CommandLink\([\s\S]*?function commandOptionId/)?.[0] ?? "";

    expect(dialogBlock).toContain('role="combobox"');
    expect(dialogBlock).toContain('aria-controls="command-palette-results"');
    expect(dialogBlock).toContain("aria-activedescendant");
    expect(dialogBlock).toContain("commandOptionId(safeActiveCommandIndex)");
    expect(dialogBlock).not.toContain("commandOptionId(activeCommandIndex)");
    expect(dialogBlock).toContain('role="listbox"');
    expect(dialogBlock).toContain('aria-label="Command palette results"');
    expect(commandLinkBlock).toContain("id={commandOptionId(index)}");
    expect(commandLinkBlock).toContain('role="option"');
    expect(commandLinkBlock).toContain("aria-selected={active}");
  });

  it("guards every assistant sheet prompt against invented numbers", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench-chrome.tsx"),
      "utf8",
    );
    const assistantContextBlock =
      source.match(/function assistantContext\([\s\S]*?function readStoredLinks/)?.[0] ?? "";

    expect(assistantContextBlock).toContain("function guardAssistantPrompt(prompt: string)");
    expect(assistantContextBlock).toContain(".map((prompt) => ({");
    expect(assistantContextBlock).toContain("prompt: guardAssistantPrompt(prompt.prompt)");
    expect(assistantContextBlock).toContain("Use only visible ForeKingHell metrics");
    expect(assistantContextBlock).toContain(
      "cite the evidence labels shown in the assistant sheet",
    );
    expect(assistantContextBlock).toContain("instead of inventing it");
  });
});
