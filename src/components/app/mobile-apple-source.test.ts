import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const mobileNavSource = readFileSync(join(root, "src/components/app/mobile-nav.tsx"), "utf8");
const mobileSportsSource = readFileSync(join(root, "src/components/mobile-sports.tsx"), "utf8");
const premiumSource = readFileSync(join(root, "src/components/premium.tsx"), "utf8");
const appleCssSource = readFileSync(join(root, "src/app/mobile-apple.css"), "utf8");
const globalsCssSource = readFileSync(join(root, "src/app/globals.css"), "utf8");

describe("Apple mobile shell contract", () => {
  it("restores scroll per primary tab and reveals the compact title after scrolling", () => {
    expect(mobileNavSource).toContain('const mobileScrollStoragePrefix = "fkh:mobile-tab-scroll:"');
    expect(mobileNavSource).toContain("window.sessionStorage.getItem(tabScrollStorageKey)");
    expect(mobileNavSource).toContain("window.sessionStorage.setItem(tabScrollStorageKey");
    expect(mobileNavSource).toContain('window.addEventListener("scroll", handleScroll');
    expect(mobileNavSource).toContain('window.scrollTo({ top: storedScroll, behavior: "auto" })');
    expect(mobileNavSource).toContain("scrollY > compactTitleThreshold");
    expect(mobileNavSource).toContain("aria-hidden={!compactTitleVisible}");
    expect(mobileNavSource).not.toContain('className="ios-inline-title sr-only');
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

  it("keeps every light mobile theme on neutral iOS surfaces with green reserved for tint", () => {
    expect(appleCssSource).toContain(
      'html[data-theme="clubhouse"] body[data-mobile-platform="apple"]',
    );
    expect(appleCssSource).toContain("--ios-background: #f2f2f7;");
    expect(appleCssSource).toContain("--ios-grouped-surface: #ffffff;");
    expect(appleCssSource).toContain("--ios-tint: #087a42;");
    expect(appleCssSource).not.toContain("--ios-material-strong: rgba(9, 39, 27, 0.97)");
    expect(appleCssSource).not.toContain("font-family: var(--font-editorial-source)");
    expect(appleCssSource).not.toContain("color: #d6f356 !important");
  });

  it("applies neutral tokens and native headings before client hydration", () => {
    expect(appleCssSource).toContain('[data-mobile-platform="apple"] {');
    expect(appleCssSource).toContain('html[data-theme="clubhouse"] [data-mobile-platform="apple"]');
    expect(appleCssSource).toContain('body:has([data-mobile-platform="apple"])');
    expect(appleCssSource).toContain('[class*="font-editorial"]');
    expect(appleCssSource).toContain('"SF Pro Display"');
    expect(appleCssSource).toContain("sans-serif !important;");
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
