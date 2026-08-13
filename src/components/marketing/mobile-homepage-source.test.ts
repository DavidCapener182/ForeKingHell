import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readSource = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

const pageSource = readSource("src/app/page.tsx");
const marketingCssSource = readSource("src/components/marketing/marketing.module.css");
const storySource = readSource("src/components/marketing/scroll-product-story.tsx");
const zoomSource = readSource("src/components/marketing/scroll-zoom-frame.tsx");

describe("public homepage mobile design source contract", () => {
  it("scopes the Apple system stack to the exact compact breakpoint", () => {
    const compactRule = "@media (max-width: 767px)";
    const mobileStart = marketingCssSource.indexOf(compactRule);
    expect(mobileStart).toBeGreaterThan(0);

    const desktopSource = marketingCssSource.slice(0, mobileStart);
    const mobileSource = marketingCssSource.slice(mobileStart);
    const appleStack =
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

    expect(desktopSource).toContain("font-family: var(--font-ui-source), sans-serif;");
    expect(desktopSource).not.toContain("--font-mobile-apple");
    expect(desktopSource).not.toContain(appleStack);
    expect(mobileSource).toMatch(
      /--font-mobile-apple:\s+-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial,\s+sans-serif/,
    );
    expect(mobileSource).toContain("font-family: var(--font-mobile-apple);");
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
