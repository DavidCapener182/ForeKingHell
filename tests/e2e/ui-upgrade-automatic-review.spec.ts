import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("Automatic review layout and evidence recovery", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=${encodeURIComponent("/shots/review")}`);
    await expect(
      page.getByRole("heading", { name: "Review shots", level: 1, exact: true }),
    ).toBeVisible({ timeout: 60000 });
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await page.screenshot({ path: info.outputPath(`P07-${surface}-${width}.png`) });
    }
    const evidence = page.getByRole("button", { name: "Full evidence", exact: true }).first();
    if (await evidence.count()) {
      await evidence.click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByRole("tab", { name: "Source", exact: true })).toBeVisible({
        timeout: 30000,
      });
      await sheet.getByRole("tab", { name: "Source", exact: true }).click();
      await expect(sheet.getByText("Source record", { exact: true })).toBeVisible();
      await sheet.getByRole("button", { name: "Close evidence", exact: true }).click();
      await expect(evidence).toBeFocused();
      await page.getByRole("button", { name: "Keep", exact: true }).first().click();
      await expect(page.getByRole("alertdialog")).toContainText("Raw measurements");
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  }
  expect((await page.request.get("/api/shots/not-a-shot/evidence")).status()).toBe(404);
  expect(errors).toEqual([]);
});
