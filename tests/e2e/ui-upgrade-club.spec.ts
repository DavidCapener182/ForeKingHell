import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("Club profile keeps every analysis and exact shot evidence", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
  await page.goto("/bag");
  const link = page.locator('a[href^="/bag/"]').filter({ hasNotText: "Best" }).first();
  await expect(link).toBeVisible({ timeout: 60000 });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/bag\/[a-f0-9-]{36}$/);
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=${encodeURIComponent(href!)}`);
    await expect(page.locator("[data-club-analysis-ui]")).toBeVisible({ timeout: 60000 });
    await expect(page.locator("[data-url-tabs]")).toHaveAttribute("data-ready", "true");
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      for (const name of [
        "Dispersion",
        "Intelligence & trend",
        "Shot evidence",
        "Trajectory",
        "Club metrics",
        "Shot history",
      ]) {
        const tab = page.getByRole("tab", { name, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        ).toBe(false);
      }
      await page.getByRole("tab", { name: "Dispersion", exact: true }).click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P09-${surface}-${width}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Full evidence", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("tab", { name: "Source", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await sheet.getByRole("tab", { name: "Source", exact: true }).click();
    await expect(sheet.getByText("Source record", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Close evidence", exact: true }).click();
    await page.getByRole("tab", { name: "Shot evidence", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("tab", { name: "Shot evidence", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }
  expect(errors).toEqual([]);
});
