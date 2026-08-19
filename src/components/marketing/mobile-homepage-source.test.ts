import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readSource = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

const pageSource = readSource("src/app/page.tsx");
const marketingCssSource = readSource("src/components/marketing/marketing.module.css");
const storySource = readSource("src/components/marketing/scroll-product-story.tsx");
const zoomSource = readSource("src/components/marketing/scroll-zoom-frame.tsx");
const heroSource = readSource("src/components/marketing/hero-product-stage.tsx");
const tourSource = readSource("src/components/marketing/sample-product-tour.tsx");
const mobileShowcaseSource = readSource("src/components/marketing/mobile-product-showcase.tsx");

const compactRule = "@media (max-width: 767px)";
const mobileStart = marketingCssSource.indexOf(compactRule);
const desktopMarketingCss = marketingCssSource.slice(0, mobileStart);
const mobileMarketingCss = marketingCssSource.slice(mobileStart);

describe("public homepage mobile design source contract", () => {
  it("scopes the Apple system stack to the exact compact breakpoint", () => {
    expect(mobileStart).toBeGreaterThan(0);

    const appleStack =
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

    expect(desktopMarketingCss).toContain("font-family: var(--font-ui-source), sans-serif;");
    expect(desktopMarketingCss).not.toContain("--font-mobile-apple");
    expect(desktopMarketingCss).not.toContain(appleStack);
    expect(mobileMarketingCss).toMatch(
      /--font-mobile-apple:\s+-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial,\s+sans-serif/,
    );
    expect(mobileMarketingCss).toContain("font-family: var(--font-mobile-apple);");
    expect(marketingCssSource).not.toContain("@media (max-width: 768px)");
  });

  it("uses safe areas, reachable controls and visible compact-page focus", () => {
    expect(marketingCssSource).toContain("env(safe-area-inset-top)");
    expect(marketingCssSource).toContain("env(safe-area-inset-right)");
    expect(marketingCssSource).toContain("env(safe-area-inset-bottom)");
    expect(marketingCssSource).toContain("env(safe-area-inset-left)");
    expect(marketingCssSource).toContain("min-height: 2.75rem;");
    expect(marketingCssSource).toContain(":focus-visible");
    expect(marketingCssSource).toContain("outline: 3px solid #17824f;");
    expect(marketingCssSource).toContain("100dvh");
    expect(marketingCssSource).toContain("100svh");
  });

  it("keeps a safe-area-aware primary beta action reachable without covering the footer", () => {
    expect(heroSource).toContain("data-mobile-sticky-cta");
    expect(heroSource).toContain("className={styles.mobileStickyCtaButton}");
    expect(heroSource).toContain("href={marketingJoinBetaHref}");
    expect(desktopMarketingCss).toMatch(/\.mobileStickyCtaDock\s*{\s*display: none;/);
    expect(mobileMarketingCss).toMatch(
      /\.mobileStickyCtaDock\s*{[\s\S]*?position: fixed;[\s\S]*?bottom: 0;[\s\S]*?env\(safe-area-inset-bottom\)/,
    );
    expect(mobileMarketingCss).toContain(
      "padding-bottom: calc(4.75rem + env(safe-area-inset-bottom));",
    );
    expect(mobileMarketingCss).toContain("background: var(--mobile-grouped);");
    expect(mobileMarketingCss).toContain("background: var(--marketing-green);");
  });

  it("turns the compact sample chapters into an accessible swipe rail with a next-card peek", () => {
    expect(tourSource).toContain('aria-roledescription="carousel"');
    expect(tourSource).toContain('aria-roledescription="slide"');
    expect(tourSource).toContain("Swipe or use arrow keys to explore each chapter");
    expect(tourSource).toContain('event.key === "ArrowRight"');
    expect(tourSource).toContain('event.key === "ArrowLeft"');
    expect(tourSource).toContain('event.key === "Home"');
    expect(tourSource).toContain('event.key === "End"');
    expect(tourSource).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(tourSource).toContain("controlledMobileScrollTargetRef");
    expect(tourSource).toContain("scheduleMobileRailCommit");
    expect(tourSource).toContain("commitStepFromMobileRail");
    expect(tourSource).toContain("onScrollEnd=");
    expect(tourSource).toContain("data-tour-step-status");
    expect(tourSource).not.toContain("nextStep !== step");
    expect(tourSource).toContain("<Tabs");
    expect(desktopMarketingCss).toMatch(/\.tourMobileExperience\s*{\s*display: none;/);
    expect(mobileMarketingCss).toMatch(/\.tourDesktopExperience\s*{\s*display: none;/);
    expect(mobileMarketingCss).toContain("scroll-snap-type: x mandatory;");
    expect(mobileMarketingCss).toContain("scroll-snap-stop: always;");
    expect(mobileMarketingCss).toContain("flex: 0 0 calc(100% - 2.75rem);");
    expect(mobileMarketingCss).toContain("background: var(--mobile-surface);");
  });

  it("keeps the opening proposition compact and shows the established companion destinations", () => {
    expect(mobileMarketingCss).toContain("min-height: clamp(26rem, 118vw, 30rem);");
    expect(mobileMarketingCss).not.toContain("min-height: clamp(33rem, 140vw, 38rem);");
    expect(heroSource).toContain("Turn every measured shot into a better golf game.");
    expect(mobileShowcaseSource).toContain("Today, Practice, Play, Sessions and More");
    expect(mobileShowcaseSource).toContain("Today · Demo data");
    expect(mobileShowcaseSource).not.toContain("Home, Sessions, Analyse, Practice and More");

    const destinationMarkup = [
      "<span>Today</span>",
      "<span>Practice</span>",
      "<span>Play</span>",
      "<span>Sessions</span>",
      "/> More",
    ];
    const destinationPositions = destinationMarkup.map((markup) =>
      mobileShowcaseSource.indexOf(markup),
    );
    expect(destinationPositions.every((position) => position > 0)).toBe(true);
    expect(destinationPositions).toEqual([...destinationPositions].sort((a, b) => a - b));
  });

  it("removes compact scroll choreography and supplies motion and material fallbacks", () => {
    for (const source of [storySource, zoomSource]) {
      expect(source).toContain('matchMedia("(max-width: 767px)")');
      expect(source).toContain("usesCompactLayout");
      expect(source).toMatch(/prefersReducedMotion \|\| usesCompactLayout/);
    }

    expect(marketingCssSource).toContain(
      "@media (max-width: 767px) and (prefers-reduced-transparency: reduce)",
    );
    expect(marketingCssSource).toContain(
      "@media (max-width: 767px) and (prefers-reduced-motion: reduce)",
    );
    expect(marketingCssSource).toContain("animation: none;");
    expect(marketingCssSource).toContain("transition: none;");
    expect(mobileMarketingCss).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*?\.tourSwipeRail\s*{\s*scroll-behavior: auto;/,
    );
  });

  it("keeps the redesign inside the public marketing CSS module", () => {
    expect(pageSource).toContain(
      'import styles from "@/components/marketing/marketing.module.css";',
    );
    expect(pageSource).not.toContain('import "./globals.css"');
    expect(pageSource).not.toContain("mobile-apple.css");
    expect(pageSource).toContain("<MarketingHeader />");
    expect(pageSource).toContain("<LazyCourseTwinShowcase />");
    expect(pageSource).toContain('className={styles.page} id="product"');
  });
});
