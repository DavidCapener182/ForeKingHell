import { expect, test, type Page } from "@playwright/test";
import { prepareFlightPathFixture } from "./flight-path-fixture";
const fixtureCleanup = new WeakMap<Page, () => Promise<void>>();
test.beforeEach(async ({ page }, info) => {
  fixtureCleanup.set(
    page,
    await prepareFlightPathFixture(page, String(info.project.use.baseURL), true),
  );
});
test.afterEach(async ({ page }) => {
  await fixtureCleanup.get(page)?.();
});
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("Coach exposes diagnosis, source details and conversation on both surfaces", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=/coach`);
    await expect(page.getByRole("heading", { name: "Coach", exact: true })).toBeVisible({
      timeout: 60000,
    });
    const tools = page.getByRole("button", { name: "Coach tools", exact: true });
    await tools.click();
    await expect(page.getByRole("menuitem", { name: "Players", exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Reports", exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Driver Speed Development", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tools).toBeFocused();
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      await page.getByRole("tab", { name: "Diagnosis", exact: true }).click();
      const causes = page.locator("details").filter({
        has: page.locator("summary", { hasText: "Contributing causes and confidence" }),
      });
      if (!(await causes.evaluate((element) => (element as HTMLDetailsElement).open))) {
        await causes.locator("summary").click();
      }
      await expect(
        page.getByRole("heading", { name: "Three signals behind the read", exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await page.getByRole("tab", { name: "Evidence", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Source sessions", exact: true }),
      ).toBeVisible();
      await page.locator('section[aria-label="Source session records"] ul button').first().click();
      await expect(
        page.getByRole("link", { name: "Open full session evidence", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close source", exact: true }).click();
      await page.getByRole("tab", { name: "Ask your data", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Ask your data", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await expect(page.locator("h1")).toHaveCount(1);
      await page.getByRole("tab", { name: "Diagnosis", exact: true }).click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P17-${surface}-${width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
