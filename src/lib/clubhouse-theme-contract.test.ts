import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
const mobile = readFileSync(join(root, "src/app/mobile-apple.css"), "utf8");
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const themeBootstrap = readFileSync(
  join(root, "src/components/theme-bootstrap-script.tsx"),
  "utf8",
);
const controller = readFileSync(join(root, "src/components/theme-controller.tsx"), "utf8");
const chart = readFileSync(join(root, "src/components/ui/chart.tsx"), "utf8");
const settings = readFileSync(join(root, "src/app/(app)/settings/page.tsx"), "utf8");
const premium = readFileSync(join(root, "src/components/premium.tsx"), "utf8");
const metricCard = readFileSync(join(root, "src/components/app/metric-card.tsx"), "utf8");
const desktopWorkbench = readFileSync(
  join(root, "src/components/app/desktop-workbench.tsx"),
  "utf8",
);
const desktopWorkbenchControls = readFileSync(
  join(root, "src/components/app/desktop-workbench-controls.tsx"),
  "utf8",
);
const importForm = readFileSync(join(root, "src/app/import/import-form.tsx"), "utf8");
const offlineStorage = readFileSync(
  join(root, "src/app/settings/offline-storage-panel.tsx"),
  "utf8",
);
const facePathChart = readFileSync(
  join(root, "src/components/visuals/face-path-delivery-chart.tsx"),
  "utf8",
);
const clubhouseTokens = globals.match(/html\[data-theme="clubhouse"\] \{([\s\S]*?)\n\}/)?.[1] ?? "";

describe("Clubhouse Manager theme contract", () => {
  it("defines the required semantic palette and shared-surface scope", () => {
    expect(globals).toContain('html[data-theme="clubhouse"]');

    for (const token of [
      "--background: #f1ead9",
      "--card: #fbf7ec",
      "--primary: #123a29",
      "--foreground: #18251e",
      "--clubhouse-muted: #4f574f",
      "--border: #b9aa8c",
      "--clubhouse-oxblood: #75342e",
      "--clubhouse-gold: #ad8a48",
      "--clubhouse-live: #d6f356",
      "--clubhouse-cobalt: #1555d6",
      "--clubhouse-focus: #8f2b08",
      "--chart-plot-background: #f7f0df",
      "--chart-grid: #cbbd9f",
      "--delivery-face: #1555d6",
      "--delivery-path: #75342e",
    ]) {
      expect(globals).toContain(token);
    }

    for (const sharedClass of [
      ".premium-card",
      ".premium-hero",
      ".desktop-page-header",
      ".desktop-data-panel",
      ".metric-tile",
      ".luxury-metric-card",
      ".apple-panel",
      ".soft-panel",
      ".chart-frame",
      ".data-table-scroll",
      ".premium-route-tabs",
    ]) {
      expect(globals).toContain(sharedClass);
    }
  });

  it("keeps the mobile shell and light colour scheme scoped to clubhouse", () => {
    expect(mobile).toContain('html[data-theme="clubhouse"]');
    expect(mobile).toContain("--ios-radius: 0.375rem");
    expect(mobile).toContain('.ios-tab-bar .ios-tab-item[aria-current="page"]');
    expect(controller).toContain(
      'root.style.colorScheme = usesDarkColourScheme ? "dark" : "light"',
    );
    expect(controller).toContain("window.sessionStorage.getItem(themePreviewStorageKey)");
    expect(globals).toContain("transition-property: none");
  });

  it("bootstraps every explicit theme before interactivity", () => {
    expect(layout).toContain("<head>");
    expect(themeBootstrap).toContain("dangerouslySetInnerHTML={{ __html: script }}");
    expect(themeBootstrap).not.toContain('strategy="beforeInteractive"');
    expect(themeBootstrap).toContain('const theme = preference === "system"');
    expect(themeBootstrap).toContain("const colours = ${JSON.stringify(themeColourByMode)}");
    expect(themeBootstrap).toContain(
      'root.style.colorScheme = usesDarkColourScheme ? "dark" : "light"',
    );
    expect(themeBootstrap).toContain('meta.setAttribute("content", colours[theme])');
    expect(themeBootstrap).toContain("sessionStorage.getItem(themePreviewStorageKey)");
    expect(themeBootstrap).toContain("sessionStorage.removeItem(themePreviewStorageKey)");
    expect(themeBootstrap).not.toContain("if (previewPreference === savedPreference)");
    expect(themeBootstrap).toContain("preference = previewPreference");
  });

  it("provides Clubhouse chart colours without changing existing Light and Dark series", () => {
    expect(chart).toContain("clubhouse: 'html[data-theme=\"clubhouse\"]'");
    expect(chart).toContain("fallbackThemeColor(itemConfig.theme, theme as keyof typeof THEMES)");
    expect(chart).toContain('data-slot="chart-tooltip"');
    expect(chart).toContain('data-slot="chart-legend"');
    expect(globals).toContain('[data-slot="chart-tooltip"]');
    expect(globals).toContain('[data-slot="chart-legend"]');
    expect(facePathChart).toContain('stroke="var(--delivery-face, #111827)"');
    expect(facePathChart).toContain('stroke="var(--delivery-path, #B91C1C)"');
  });

  it("uses semantic surfaces for the settings controls migrated in this pass", () => {
    for (const legacyLiteral of ["#F5F6F4", "bg-white", "accent-[#0B7A3B]"]) {
      expect(settings).not.toContain(legacyLiteral);
      expect(offlineStorage).not.toContain(legacyLiteral);
    }

    expect(settings).toContain("bg-muted/40");
    expect(settings).toContain("bg-card");
    expect(offlineStorage).toContain("bg-muted/40");
  });

  it("keeps card headers on the same paper surface as their cards", () => {
    expect(globals).not.toContain(
      "background: color-mix(in srgb, var(--surface-strong) 82%, var(--clubhouse-gold) 18%);",
    );
    expect(globals).not.toContain("box-shadow: inset 4px 0 0 var(--clubhouse-oxblood);");
  });

  it("keeps dark hero copy colours out of nested paper metric tiles", () => {
    expect(premium).toContain("data-page-header-copy");
    expect(globals).toMatch(/\.desktop-page-header\s+\[data-page-header-copy\]/);
    expect(globals).not.toContain(".desktop-page-header :where(p, .text-muted-foreground)");
    expect(globals).not.toContain(".desktop-page-header :where(h1, .text-foreground)");
  });

  it("keeps small muted copy readable on Clubhouse paper surfaces", () => {
    const mutedText = clubhouseTokens.match(/--muted-foreground:\s*(#[0-9a-f]{6})/i)?.[1];

    expect(mutedText).toBeDefined();
    expect(contrastRatio(mutedText ?? "#ffffff", "#fbf7ec")).toBeGreaterThanOrEqual(4.5);
  });

  it("uses a restrained two-surface hierarchy and keeps oxblood off ordinary panels", () => {
    expect(globals).toContain("--surface-strong: #fbf7ec");
    expect(globals).toContain("--surface-soft: #f1ead9");
    expect(globals).not.toContain(":where(.premium-hero, .premium-command-surface)");
    expect(globals).toContain('html[data-theme="clubhouse"] .premium-command-surface');
    expect(globals).toContain('html[data-theme="clubhouse"] [data-slot="card-header"]');
    expect(globals).toContain("background: transparent;");
  });

  it("exposes semantic tones, current workflow state and live import readiness", () => {
    expect(premium).toContain("data-tone={tone}");
    expect(metricCard).toContain("data-tone={tone}");
    expect(desktopWorkbench).toContain("data-workflow-status={status}");
    expect(importForm).toContain('data-clubhouse-state={canSave ? "live" : "current"}');
    expect(globals).toContain('[data-tone="sky"]');
    expect(globals).toContain('[data-workflow-status="current"]');
    expect(globals).toContain('[data-clubhouse-state="live"]');
  });

  it("refines the scorecard, sidebar and mobile shell without literal light surfaces", () => {
    expect(globals).toContain('[data-slot="sidebar-group-label"]');
    expect(globals).toContain("border-bottom-color: var(--primary)");
    expect(mobile).not.toContain("border-bottom: 3px solid var(--clubhouse-oxblood)");
    expect(mobile).not.toContain("border-top: 3px solid var(--clubhouse-oxblood)");
    expect(desktopWorkbench).not.toContain("bg-white/86");
    expect(desktopWorkbench).not.toContain("bg-white/60");
    expect(desktopWorkbenchControls).not.toContain(
      'className="rounded border border-border bg-white',
    );
  });
});

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    return 1;
  }

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
