import { expect, test, type Page } from "@playwright/test";

import { authStorageState, expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("mobile launch monitor loop", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("starts the dashboard with the AI caddie brief below the fixed app bar", async ({
    page,
  }) => {
    await gotoAuthenticatedOrSkip(page, "/dashboard", /Today's AI Caddie Brief/i);

    await expect(
      page.getByRole("heading", { name: /practice|import|build/i }).first(),
    ).toBeVisible();
    await expect(page.getByText("Structured JSON")).toBeVisible();
    await expect(page.getByRole("link", { name: "Start today's practice" })).toHaveAttribute(
      "href",
      /\/practice\?source=caddie&time=/,
    );

    const layout = await page.evaluate(() => {
      const appBar = document.querySelector('[aria-label="Mobile app bar"]');
      const main = document.querySelector("main");
      const caddie = Array.from(document.querySelectorAll("section")).find((section) =>
        section.textContent?.includes("Today's AI Caddie Brief"),
      );

      return {
        appBarBottom: appBar?.getBoundingClientRect().bottom ?? 0,
        mainTop: main?.getBoundingClientRect().top ?? 0,
        caddieTop: caddie?.getBoundingClientRect().top ?? 0,
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(layout.mainTop).toBeGreaterThanOrEqual(layout.appBarBottom - 1);
    expect(layout.caddieTop).toBeGreaterThan(layout.appBarBottom);
    expect(layout.horizontalOverflow).toBeLessThanOrEqual(2);
  });

  test("uses a route-level CSV import wizard on mobile", async ({ page }) => {
    await gotoAuthenticatedOrSkip(page, "/import?source=csv#csv-import", /CSV import/i);

    await expect(
      page.locator("[data-mobile-route-label]", { hasText: "CSV import" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Import launch monitor shots" })).toBeVisible();
    await expect(page.locator('#csv-import [data-import-ready="true"]')).toBeVisible();
    await expect(page.getByText("Other sources")).toHaveCount(0);
  });

  test("keeps CSV as a source choice, not a sheet-hosted wizard", async ({ page }) => {
    await gotoAuthenticatedOrSkip(page, "/import", /Rapsodo import/i);

    const csvSource = page.getByRole("link", { name: "CSV" });
    await expect(csvSource).toBeVisible();
    await expect(csvSource).toHaveAttribute("href", /\/import\?source=csv#csv-import/);
    await expect(page.getByText(/We do not store your Rapsodo password/i)).toBeVisible();
  });

  test("surfaces mobile dispersion before the shot list", async ({ page }) => {
    await gotoAuthenticatedOrSkip(page, "/shots", /Dispersion map/i);

    await expect(page.getByRole("heading", { name: "Dispersion map" })).toBeVisible();
    await expect(page.locator('[aria-label="Club dispersion filters"]')).toBeVisible();
    await expect(page.locator("#dispersion [data-media-container]").first()).toBeVisible();
  });

  test("keeps five primary tabs clear of content and exposes the analysis loop", async ({
    page,
  }) => {
    await gotoAuthenticatedOrSkip(page, "/analyse", /Evidence hub|Analyse/i);

    const nav = page.getByRole("navigation", { name: "Mobile primary" });
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(nav.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Sessions" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Analyse" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Bag" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Profile" })).toBeVisible();

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

  test("starts practice with a mobile launch-monitor cockpit", async ({ page }) => {
    await gotoAuthenticatedOrSkip(page, "/practice", /Active session mode/i);

    const cockpit = page.locator("section", { hasText: "Active session mode" }).first();
    await expect(cockpit).toBeVisible();
    await expect(
      cockpit.getByText(/Practice scoring is driven by imported launch-monitor shots/i),
    ).toBeVisible();
    await expect(cockpit.getByText("Carry", { exact: true })).toBeVisible();
    await expect(cockpit.getByText("Spin", { exact: true })).toBeVisible();
    await expect(cockpit.getByText("Smash", { exact: true })).toBeVisible();
    await expect(cockpit.getByText("Readiness", { exact: true })).toBeVisible();
  });

  test("keeps the Apple mobile shell when an iPhone rotates to landscape", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await gotoAuthenticatedOrSkip(page, "/today", /Latest session|Today/i);

    const mobileNav = page.getByRole("navigation", { name: "Mobile primary" });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("link")).toHaveCount(5);
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
    await gotoAuthenticatedOrSkip(page, "/today", /Latest session|Today/i);
    await page.evaluate(() => window.sessionStorage.removeItem("fkh:mobile-tab-scroll:/today"));
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: "auto" }));
    await expect(page.locator(".ios-inline-title")).toHaveCSS("opacity", "1");

    await page
      .getByRole("navigation", { name: "Mobile primary" })
      .getByRole("link", {
        name: "Sessions",
      })
      .click();
    await expect(page).toHaveURL(/\/sessions$/);
    expect(
      await page.evaluate(() => window.sessionStorage.getItem("fkh:mobile-tab-scroll:/today")),
    ).toBe("700");

    await page.goto("/today", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/today$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(700);
  });
});

async function gotoAuthenticatedOrSkip(page: Page, path: string, expectedText: RegExp | string) {
  skipWhenNoAuth();
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});

  test.skip(/\/login(?:\?|$)/.test(page.url()), "Stored auth state redirected to login.");
  await expectPageReady(page, expectedText);
}
