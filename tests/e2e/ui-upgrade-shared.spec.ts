import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Read-only: no uploads, invitations, payments, saves or destructive actions.
// Reuse an existing authorised storage state without rewriting or exporting it.
const authState = process.env.PLAYWRIGHT_AUTH_STATE;
test.use(authState ? { storageState: authState } : {});
test.skip(
  !authState && process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1",
  "Requires authorised local fixture/auth state.",
);

const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 1023, height: 800 },
  { width: 1024, height: 800 },
];
const evidence = path.join(process.cwd(), "output/playwright/ui-upgrade");

test.describe("UI upgrade shared components", () => {
  test.setTimeout(180_000);
  test.beforeEach(async ({ page }, testInfo) => {
    page.setDefaultTimeout(15_000);
    test.skip(testInfo.project.name !== "chromium", "Explicit six-viewport matrix runs once.");
    mkdirSync(evidence, { recursive: true });
    // Avoid background prefetches and their unrelated route work during captures.
    await page.route("**/*", async (route) => {
      const headers = route.request().headers();
      if (headers["next-router-prefetch"] === "1" || headers.purpose === "prefetch") {
        await route.abort();
      } else {
        await route.continue();
      }
    });
  });

  test("G01: header and primary action remain readable at all specified widths", async ({
    page,
  }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      // Exercise the shared header itself at narrow widths. Goals' companion
      // summary is a separate, still-unfinished route task, not covered here.
      await page.goto("/surface/workbench?next=%2Fgoals");
      await expect(page).not.toHaveURL(/\/login/);
      const header = page.locator("[data-ui-page-header]");
      await expect(header).toBeVisible();
      await expect(header.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(header.getByRole("link", { name: "Start quick range" })).toBeVisible();
      await header.getByRole("link", { name: "Start quick range" }).focus();
      await expect(header.getByRole("link", { name: "Start quick range" })).toBeFocused();
      const bounds = await header.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(await header.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await page.screenshot({
        path: path.join(evidence, `G01-goals-${viewport.width}x${viewport.height}.png`),
      });
    }
  });

  test("G05: selected companion body stays visible across the lg boundary", async ({ page }) => {
    await page.goto("/surface/companion?next=%2Ftoday%3FupgradeProbe%3Dpreserved");
    await expect(page).not.toHaveURL(/\/login/);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(page.locator('[data-app-surface="companion"]')).toBeVisible();
      await expect(page.locator("main:visible")).toHaveCount(1);
      const content = page.locator(".ios-mobile-screen");
      await expect(content).toBeVisible();
      expect((await content.innerText()).trim().length).toBeGreaterThan(20);
      await page.screenshot({
        path: path.join(evidence, `G05-today-companion-${viewport.width}x${viewport.height}.png`),
      });
    }
    await page.getByRole("button", { name: /Open more tools and profile/ }).click();
    const switchLink = page.getByRole("link", { name: "Open full desktop site" });
    await expect(switchLink).toBeVisible();
    await switchLink.click();
    await expect(page).toHaveURL(/\/today\?upgradeProbe=preserved/);
    await expect(page.locator('[data-app-surface="workbench"]')).toBeVisible();
    await expect(page.locator("[data-desktop-workbench-hydrated]")).toHaveAttribute(
      "data-desktop-workbench-hydrated",
      "true",
    );
    await page.getByRole("button", { name: "Open account menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Open companion app" }).click();
    await expect(page).toHaveURL(/\/today\?upgradeProbe=preserved/);
    await expect(page.locator('[data-app-surface="companion"] .ios-mobile-screen')).toBeVisible();
  });

  test("G06: More searches authorised tasks and restores focus at every specified width", async ({
    page,
  }) => {
    await page.goto("/surface/companion?next=%2Ftoday");
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const trigger = page.getByRole("button", { name: /Open more tools and profile/ });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Your golf" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCSS("opacity", "1");
      const search = dialog.getByRole("searchbox", { name: "Search navigation" });
      await search.fill("Billing");
      await expect(dialog.getByRole("link", { name: "Billing", exact: true })).toBeVisible();
      const bounds = await dialog.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({
        path: path.join(evidence, `G06-more-${viewport.width}x${viewport.height}.png`),
      });
      await search.fill("no-such-navigation-result");
      await expect(dialog.getByText("No matching pages", { exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: "Clear search" }).click();
      await expect(search).toHaveValue("");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      for (const item of await page
        .getByRole("navigation", { name: "Mobile primary" })
        .getByRole("link")
        .all()) {
        const target = await item.boundingBox();
        expect(target!.height).toBeGreaterThanOrEqual(44);
        expect(target!.width).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
