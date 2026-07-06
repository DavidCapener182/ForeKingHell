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
});

async function gotoAuthenticatedOrSkip(page: Page, path: string, expectedText: RegExp | string) {
  skipWhenNoAuth();
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});

  test.skip(/\/login(?:\?|$)/.test(page.url()), "Stored auth state redirected to login.");
  await expectPageReady(page, expectedText);
}
