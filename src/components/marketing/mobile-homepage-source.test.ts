import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readSource = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

const pageSource = readSource("src/app/page.tsx");
const marketingCssSource = readSource("src/components/marketing/marketing.module.css");
const cinematicCssSource = readSource("src/components/marketing/cinematic.module.css");
const storySource = readSource("src/components/marketing/scroll-product-story.tsx");
const zoomSource = readSource("src/components/marketing/scroll-zoom-frame.tsx");
const heroSource = readSource("src/components/marketing/hero-product-stage.tsx");
const revealSource = readSource("src/components/marketing/reveal.tsx");
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
    expect(cinematicCssSource).toContain("env(safe-area-inset-top)");
    expect(cinematicCssSource).toContain("env(safe-area-inset-right)");
    expect(cinematicCssSource).toContain("env(safe-area-inset-bottom)");
    expect(cinematicCssSource).toContain("env(safe-area-inset-left)");
    expect(cinematicCssSource).toContain("min-height: 2.75rem;");
    expect(cinematicCssSource).toContain(":focus-visible");
    expect(cinematicCssSource).toContain("outline: 3px solid var(--cinema-yellow);");
    expect(cinematicCssSource).toContain("100svh");
  });

  it("keeps a reachable primary action and purpose-composed compact hero art", () => {
    expect(heroSource).toContain("className={cinematic.heroActions}");
    expect(heroSource).toContain("href={marketingJoinBetaHref}");
    expect(heroSource).toContain("/assets/landing/hero-course-mobile.avif");
    expect(heroSource).toContain("/assets/landing/hero-golfer.webp");
    expect(cinematicCssSource).toContain("bottom: max(1.5rem, env(safe-area-inset-bottom));");
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

  it("uses the cinematic proposition and keeps the established companion destination source", () => {
    expect(cinematicCssSource).toContain("min-height: 100svh;");
    expect(heroSource).toContain("Stop guessing.");
    expect(heroSource).toContain("Start knowing.");
    expect(heroSource).toContain("Turn measured shots into a trusted bag");
    expect(mobileShowcaseSource).toContain("Today, Practice, Strategy, Review and Bag");
    expect(mobileShowcaseSource).toContain("Today · Demo data");
    expect(mobileShowcaseSource).not.toContain("Home, Sessions, Analyse, Practice and More");

    const destinationMarkup = [
      "<span>Today</span>",
      "<span>Practice</span>",
      "<span>Strategy</span>",
      "<span>Review</span>",
      "<span>Bag</span>",
    ];
    const destinationPositions = destinationMarkup.map((markup) =>
      mobileShowcaseSource.indexOf(markup),
    );
    expect(destinationPositions.every((position) => position > 0)).toBe(true);
    expect(destinationPositions).toEqual([...destinationPositions].sort((a, b) => a - b));
  });

  it("removes compact scroll choreography and supplies motion and material fallbacks", () => {
    expect(storySource).toContain('matchMedia("(max-width: 767px)")');
    expect(storySource).toContain("usesCompactLayout");
    expect(storySource).toMatch(/prefersReducedMotion \|\| usesCompactLayout/);

    expect(zoomSource).toContain('matchMedia("(max-width: 767px)")');
    expect(zoomSource).toContain("compactLayoutQuery.matches");
    expect(zoomSource).toContain('compactLayoutQuery.addEventListener("change", syncMotion)');
    expect(zoomSource).toContain('target.style.removeProperty("transform")');

    expect(marketingCssSource).toContain(
      "@media (max-width: 767px) and (prefers-reduced-transparency: reduce)",
    );
    expect(marketingCssSource).toContain(
      "@media (max-width: 767px) and (prefers-reduced-motion: reduce)",
    );
    expect(cinematicCssSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cinematicCssSource).toContain("clip-path: none;");
    expect(marketingCssSource).toContain("animation: none;");
    expect(marketingCssSource).toContain("transition: none;");
    expect(mobileMarketingCss).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*?\.tourSwipeRail\s*{\s*scroll-behavior: auto;/,
    );
  });

  it("keeps server-rendered marketing content visible until the reveal controller is ready", () => {
    expect(pageSource).toContain('data-marketing-motion="idle"');
    expect(cinematicCssSource).toContain(
      '.page[data-marketing-motion="ready"] [data-marketing-reveal]',
    );
    expect(cinematicCssSource).not.toMatch(
      /\.page \[data-marketing-reveal\]\s*\{\s*opacity: var\(--reveal-opacity, 0\)/,
    );
    expect(revealSource).toContain('marketingPage.dataset.marketingMotion = "ready"');
  });

  it("holds the completed Course Twin plan before opening the digital twin", () => {
    expect(revealSource).toContain("route: [0.56, 0.74]");
    expect(revealSource).toContain("twin: [0.84, 0.98]");
  });

  it("keeps the redesign inside the public marketing CSS module", () => {
    expect(pageSource).toContain(
      'import styles from "@/components/marketing/marketing.module.css";',
    );
    expect(pageSource).toContain(
      'import cinematic from "@/components/marketing/cinematic.module.css";',
    );
    expect(pageSource).not.toContain('import "./globals.css"');
    expect(pageSource).not.toContain("mobile-apple.css");
    expect(pageSource).toContain("<MarketingHeader />");
    expect(pageSource).toContain("<LazyCourseTwinShowcase />");
    expect(pageSource).toContain("className={`${styles.page} ${cinematic.page}`}");
    expect(pageSource).toContain('data-marketing-motion="idle"');
  });
});
