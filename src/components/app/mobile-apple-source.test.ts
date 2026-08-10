import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const mobileNavSource = readFileSync(join(root, "src/components/app/mobile-nav.tsx"), "utf8");
const mobileSportsSource = readFileSync(join(root, "src/components/mobile-sports.tsx"), "utf8");
const premiumSource = readFileSync(join(root, "src/components/premium.tsx"), "utf8");
const appleCssSource = readFileSync(join(root, "src/app/mobile-apple.css"), "utf8");
const globalsCssSource = readFileSync(join(root, "src/app/globals.css"), "utf8");

const desktopThemeNames = [
  "dark",
  "clubhouse",
  "outdoor",
  "range-night",
  "tour-broadcast",
  "high-contrast",
] as const;

function sourceAfterBalancedBlock(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);

  const openingBraceIndex = source.indexOf("{", markerIndex);
  expect(openingBraceIndex).toBeGreaterThan(markerIndex);

  let depth = 0;
  for (let index = openingBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(index + 1);
  }

  throw new Error(`Unclosed CSS block after ${marker}`);
}

describe("Apple mobile shell contract", () => {
  it("restores scroll per primary tab and always exposes the route title in the app bar", () => {
    expect(mobileNavSource).toContain('const mobileScrollStoragePrefix = "fkh:mobile-tab-scroll:"');
    expect(mobileNavSource).toContain("window.sessionStorage.getItem(tabScrollStorageKey)");
    expect(mobileNavSource).toContain("window.sessionStorage.setItem(tabScrollStorageKey");
    expect(mobileNavSource).toContain('window.addEventListener("scroll", handleScroll');
    expect(mobileNavSource).toContain('window.scrollTo({ top: storedScroll, behavior: "auto" })');
    expect(mobileNavSource).toContain("ios-inline-title min-w-0 truncate text-center");
    expect(mobileNavSource).toContain("data-mobile-route-label");
    expect(mobileNavSource).toContain("{pageTitle}");
    expect(mobileNavSource).not.toContain("compactTitleThreshold");
    expect(mobileNavSource).not.toContain("compactTitleVisible");
    expect(mobileNavSource).not.toContain("aria-hidden={!compactTitleVisible}");
  });

  it("lets PageShell own tab-bar clearance instead of padding every mobile page twice", () => {
    expect(mobileSportsSource).toContain(
      '"ios-mobile-screen -mx-4 -mt-4 grid min-h-0 content-start overflow-x-clip px-4 pb-0',
    );
    expect(mobileSportsSource).not.toContain("ios-mobile-screen -mx-4 -mt-4 grid min-h-dvh");
    expect(premiumSource).toContain("lg:px-8 lg:pb-8");
    expect(premiumSource).not.toContain("sm:pb-8");
  });

  it("keeps explicitly styled disclosure content out of closed details layouts", () => {
    expect(globalsCssSource).toContain("details:not([open]) > :not(summary)");
    expect(globalsCssSource).toContain("display: none !important;");
  });

  it("keeps mobile controls reachable and respects every safe-area edge", () => {
    expect(appleCssSource).toContain("min-height: 2.75rem !important;");
    expect(appleCssSource).not.toContain("min-height: 2rem !important;");
    expect(appleCssSource).toContain("env(safe-area-inset-left)");
    expect(appleCssSource).toContain("env(safe-area-inset-right)");
    expect(appleCssSource).toContain("env(safe-area-inset-bottom)");
    expect(mobileNavSource).toContain("env(safe-area-inset-top)");
    expect(appleCssSource).toContain("--ios-secondary-label: rgba(46, 46, 52, 0.78)");
    expect(appleCssSource).toContain("font-size: 0.6875rem !important;");
    expect(appleCssSource).toContain(".ios-tab-item:focus-visible");
    expect(appleCssSource).toContain("outline: 3px solid var(--ios-tint) !important;");
    expect(appleCssSource).toContain('body[data-mobile-platform="apple"]');
    expect(mobileNavSource).toContain("Search all tools");
  });

  it("uses bottom-sheet materials with reduced transparency and motion fallbacks", () => {
    expect(appleCssSource).toContain('[data-slot="sheet-content"][data-side="bottom"]');
    expect(appleCssSource).toContain(
      '[data-slot="drawer-content"][data-vaul-drawer-direction="bottom"]',
    );
    expect(appleCssSource).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(appleCssSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(appleCssSource).toContain("animation: none !important;");
  });

  it("ignores saved product themes on mobile and follows the system appearance instead", () => {
    expect(appleCssSource).toContain("@media (prefers-color-scheme: dark)");
    expect(appleCssSource).not.toContain("data-theme");
    expect(appleCssSource).not.toContain("clubhouse");

    for (const themeName of desktopThemeNames) {
      expect(appleCssSource).not.toContain(`data-theme="${themeName}"`);
    }
  });

  it("uses neutral Apple light and dark surfaces with system blue for primary tint", () => {
    const darkAppearanceStart = appleCssSource.indexOf("@media (prefers-color-scheme: dark)");
    expect(darkAppearanceStart).toBeGreaterThanOrEqual(0);

    const lightAppearanceSource = appleCssSource.slice(0, darkAppearanceStart);
    const darkAppearanceSource = appleCssSource.slice(darkAppearanceStart);

    expect(lightAppearanceSource).toContain("color-scheme: light;");
    expect(lightAppearanceSource).toContain("--ios-background: #f2f2f7;");
    expect(lightAppearanceSource).toContain("--ios-grouped-surface: #ffffff;");
    expect(lightAppearanceSource).toContain("--ios-tint: #007aff;");
    expect(lightAppearanceSource).toContain("--ios-link: #0066cc;");
    expect(lightAppearanceSource).toContain("--ios-action: #0066cc;");
    expect(lightAppearanceSource).toContain("--ios-positive: #248a3d;");

    expect(darkAppearanceSource).toContain("color-scheme: dark;");
    expect(darkAppearanceSource).toContain("--ios-background: #000000;");
    expect(darkAppearanceSource).toContain("--ios-grouped-surface: #1c1c1e;");
    expect(darkAppearanceSource).toContain("--ios-secondary-surface: #2c2c2e;");
    expect(darkAppearanceSource).toContain("--ios-label: #ffffff;");
    expect(darkAppearanceSource).toContain("--ios-tint: #0a84ff;");
    expect(darkAppearanceSource).toContain("--ios-link: #409cff;");
    expect(darkAppearanceSource).toContain("--ios-action: #0066cc;");
    expect(darkAppearanceSource).toContain("--ios-positive: #30d158;");

    expect(appleCssSource).toContain("--ios-background: #f2f2f7;");
    expect(appleCssSource).toContain("--ios-grouped-surface: #ffffff;");
    expect(appleCssSource).not.toContain("--ios-material-strong: rgba(9, 39, 27, 0.97)");
    expect(appleCssSource).not.toContain("font-family: var(--font-editorial-source)");
    expect(appleCssSource).not.toContain("color: #d6f356 !important");
    expect(appleCssSource).toContain("--primary: var(--ios-action);");
  });

  it("applies neutral tokens and native headings before client hydration", () => {
    expect(appleCssSource).toContain('[data-mobile-platform="apple"] {');
    expect(appleCssSource).toContain('body:has([data-mobile-platform="apple"])');
    expect(appleCssSource).toContain('[class*="font-editorial"]');
    expect(appleCssSource).toContain('"SF Pro Display"');
    expect(appleCssSource).toContain("sans-serif !important;");
  });

  it("contains the Apple override inside the mobile shell while retaining desktop themes", () => {
    expect(appleCssSource).toContain("@media (max-width: 1023px) {");
    expect(sourceAfterBalancedBlock(appleCssSource, "@media (max-width: 1023px)").trim()).toBe("");

    for (const themeName of desktopThemeNames) {
      expect(globalsCssSource).toContain(`html[data-theme="${themeName}"]`);
    }
  });

  it("keeps mobile presentations active until the shared shell changes at the lg breakpoint", () => {
    expect(appleCssSource).toContain('[class~="sm:hidden"][class~="grid"]');
    expect(appleCssSource).toContain('[class~="hidden"][class~="sm:block"]');
    expect(appleCssSource).toContain("display: none !important;");
  });

  it("gives portalled controls and data surfaces the same mobile material contract", () => {
    expect(appleCssSource).toContain('[data-slot="dialog-content"]');
    expect(appleCssSource).toContain('[data-slot="alert-dialog-content"]');
    expect(appleCssSource).toContain('[data-slot="popover-content"]');
    expect(appleCssSource).toContain('[data-slot="dropdown-menu-content"]');
    expect(appleCssSource).toContain('[data-slot="select-content"]');
    expect(appleCssSource).toContain(":where(.data-table-scroll, .chart-frame)");
  });
});
