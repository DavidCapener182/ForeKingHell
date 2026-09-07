import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("Advanced analytics preserves full evidence on both surfaces", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/bag");
  const link = page.locator('a[href^="/bag/"]').filter({ hasNotText: "Best" }).first();
  await expect(link).toBeVisible({ timeout: 60000 });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/bag\/[a-f0-9-]{36}$/);
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=${encodeURIComponent(`${href}/analytics`)}`);
    await expect(page.locator("[data-analytics-selection]")).toBeVisible({ timeout: 60000 });
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await page.getByText("Trust methodology", { exact: true }).click();
      await expect(page.getByText(/Trust is the rounded weighted sum/)).toBeVisible();
      await page.getByText("Trust methodology", { exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P10-${surface}-${width}.png`) });
    }
    await page.setViewportSize({ width: 360, height: 800 });
    const select = page.locator("button[data-analytics-shot-id]").first();
    await select.click();
    await expect(page).toHaveURL(/shotId=/);
    await page.getByRole("button", { name: "Full evidence", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("tab", { name: "Source", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await sheet.getByRole("tab", { name: "Source", exact: true }).click();
    await expect(sheet.getByText("Source record", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Close evidence", exact: true }).click();
  }
  expect(errors).toEqual([]);
});
