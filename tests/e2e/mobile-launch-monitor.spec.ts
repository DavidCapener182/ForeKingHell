import { expect, test, type Page } from "@playwright/test";

import { prepareFlightPathFixture } from "./flight-path-fixture";

import { authStorageState, expectPageReady, hasAuthenticatedE2e, skipWhenNoAuth } from "./helpers";

test.describe("mobile launch monitor loop", () => {
  test.skip(!hasAuthenticatedE2e, "Set PLAYWRIGHT_AUTH_STATE to run mobile launch checks.");
  test.use(authStorageState ? { storageState: authStorageState } : {});

  const fixtureCleanup = new WeakMap<Page, () => Promise<void>>();
  test.beforeEach(async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    fixtureCleanup.set(
      page,
      await prepareFlightPathFixture(page, String(info.project.use.baseURL), true),
    );
  });
  test.afterEach(async ({ page }) => {
    await fixtureCleanup.get(page)?.();
  });

  test("starts Today with measured session highlights below the fixed app bar", async ({
    page,
  }) => {
    await gotoAuthenticatedOrSkip(page, "/today", /Today|Home/i);
    const highlights = page.getByRole("region", { name: "Your session highlights" });
    await expect(highlights).toBeVisible();
    await expect(page.getByRole("link", { name: "Next practice", exact: true })).toHaveAttribute(
      "href",
      /\/practice/,
    );
    const layout = await page.evaluate(() => ({
      appBarBottom: document.querySelector('[aria-label="Mobile app bar"]')!.getBoundingClientRect()
        .bottom,
      mainTop: document.querySelector("main")!.getBoundingClientRect().top,
      highlightsTop: document
        .querySelector('[aria-label="Your session highlights"]')!
        .getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(layout.mainTop).toBeGreaterThanOrEqual(layout.appBarBottom - 1);
    expect(layout.highlightsTop).toBeGreaterThan(layout.appBarBottom);
    expect(layout.overflow).toBeLessThanOrEqual(2);
  });

  test("uses a route-level CSV import wizard on mobile", async ({ page }) => {
    await gotoAuthenticatedOrSkip(page, "/import?source=csv#csv-import", /Choose a range CSV/i);
    await expect(page.getByRole("button", { name: "Quick range import" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: "Choose CSV from Files" })).toBeVisible();
    await page.getByRole("button", { name: "Full import workflow" }).click();
    await expect(page.locator('[data-import-ready="true"]')).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("keeps CSV as a source choice, not a sheet-hosted wizard", async ({ page }) => {
    await gotoAuthenticatedOrSkip(page, "/import", /Choose your source/i);

    const csvSource = page.getByRole("link", { name: "Choose CSV files", exact: true });
    await expect(csvSource).toBeVisible();
    await expect(csvSource).toHaveAttribute("href", /#csv-import/);
    await page.getByRole("radio", { name: "Rapsodo R-Cloud", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio", { name: "Rapsodo R-Cloud", exact: true })).toBeChecked();
    await expect(
      page.getByRole("link", { name: "Continue to R-Cloud", exact: true }),
    ).toBeVisible();
  });

  test("mobile shot explorer exposes measured evidence and source inspection", async ({ page }) => {
    await gotoAuthenticatedOrSkip(page, "/shots", /^Shots/i);
    await expect(page.getByRole("searchbox", { name: "Search shots" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Filters/ })).toBeVisible();
    await expect(page.getByText("60 matching", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Import/ }).first()).toHaveAttribute(
      "href",
      /\/import/,
    );
  });

  test("keeps four primary tabs clear of content and exposes the analysis loop", async ({
    page,
  }) => {
    await gotoAuthenticatedOrSkip(page, "/analyse", /Evidence hub|Analyse/i);

    const nav = page.getByRole("navigation", { name: "Mobile primary" });
    await expect(nav.locator(".ios-tab-item")).toHaveCount(4);
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Activity" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Play" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Bag" })).toBeVisible();
    await page
      .getByRole("banner", { name: "Mobile app bar" })
      .getByRole("button", { name: /Open more/ })
      .click();
    await expect(page.getByRole("link", { name: "Profile" }).first()).toHaveAttribute(
      "href",
      "/profile",
    );
    await page.keyboard.press("Escape");

    const bounds = await page.evaluate(() => {
      const navRect = document
        .querySelector('[aria-label="Mobile primary"]')
        ?.getBoundingClientRect();
      const main = document.querySelector("main");
      const last = main?.lastElementChild?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        bottomPadding: main ? Number.parseFloat(getComputedStyle(main).paddingBottom) : 0,
        navHeight: navRect?.height ?? 0,
        lastBottom: last?.bottom ?? 0,
        navTop: navRect?.top ?? window.innerHeight,
      };
    });

    expect(bounds.overflow).toBeLessThanOrEqual(2);
    expect(bounds.bottomPadding).toBeGreaterThanOrEqual(bounds.navHeight);
    expect(bounds.lastBottom <= bounds.navTop || bounds.bottomPadding >= bounds.navHeight).toBe(
      true,
    );
  });

  test("starts practice with a measured programme and source evidence", async ({ page }) => {
    await gotoAuthenticatedOrSkip(page, "/practice", /Recommended for you/i);
    await expect(
      page.getByRole("heading", { name: "Today's Range Plan", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start practice", exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open the session behind this practice/ }),
    ).toHaveAttribute("href", /\/sessions\//);
    await expect(page.getByRole("heading", { name: "Practice blocks", exact: true })).toBeVisible();
  });

  test("keeps the Apple mobile shell when an iPhone rotates to landscape", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await gotoAuthenticatedOrSkip(page, "/today", /Latest session|Today|Home/i);

    const mobileNav = page.getByRole("navigation", { name: "Mobile primary" });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.locator(".ios-tab-item")).toHaveCount(4);
    await expect(mobileNav.getByRole("link")).toHaveCount(4);
    await expect(page.locator(".ios-mobile-screen")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);

    const layout = await page.evaluate(() => {
      const nav = document.querySelector('[aria-label="Mobile primary"]');
      const main = document.querySelector("main");

      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        navHeight: nav?.getBoundingClientRect().height ?? 0,
        bottomPadding: main ? Number.parseFloat(getComputedStyle(main).paddingBottom) : 0,
      };
    });
    expect(layout.overflow).toBeLessThanOrEqual(2);
    expect(layout.bottomPadding).toBeGreaterThanOrEqual(layout.navHeight);
  });

  test("restores each primary tab scroll position and reveals the compact title", async ({
    page,
  }) => {
    await gotoAuthenticatedOrSkip(page, "/today", /Latest session|Today|Home/i);
    await page.evaluate(() => window.sessionStorage.removeItem("fkh:mobile-tab-scroll:/today"));
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: "auto" }));
    await expect(page.locator(".ios-inline-title")).toHaveCSS("opacity", "1");

    await page
      .getByRole("navigation", { name: "Mobile primary" })
      .getByRole("link", {
        name: "Activity",
      })
      .click();
    await expect(page).toHaveURL(/\/sessions$/);
    await expectPageReady(page, /History|Sessions|Activity/i);
    await expect(
      page
        .getByRole("navigation", { name: "Mobile primary" })
        .getByRole("link", { name: "Activity", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(() => window.sessionStorage.getItem("fkh:mobile-tab-scroll:/today")),
    ).toBe("700");

    await page
      .getByRole("navigation", { name: "Mobile primary" })
      .getByRole("link", { name: "Home", exact: true })
      .click();
    await expect(page).toHaveURL(/\/today$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(700);
  });
});

async function gotoAuthenticatedOrSkip(page: Page, path: string, expectedText: RegExp | string) {
  skipWhenNoAuth();
  await page.goto(`/surface/companion?next=${encodeURIComponent(path)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});

  test.skip(/\/login(?:\?|$)/.test(page.url()), "Stored auth state redirected to login.");
  await expectPageReady(page, expectedText);
}
