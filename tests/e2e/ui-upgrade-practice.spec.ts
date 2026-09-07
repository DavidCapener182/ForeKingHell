import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("Practice full editor and evidence remain available on both surfaces", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=${encodeURIComponent("/practice?editor=full")}`);
    await expect(page.getByRole("button", { name: "Evidence ledger", exact: true })).toBeVisible({
      timeout: 60000,
    });
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await page.getByRole("button", { name: "Evidence ledger", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Practice evidence ledger", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close panel", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Practice evidence ledger", exact: true }),
      ).not.toBeVisible();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P15-${surface}-${width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
