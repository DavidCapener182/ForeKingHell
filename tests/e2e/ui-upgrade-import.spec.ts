import { expect, test } from "@playwright/test";
test.skip(
  process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1",
  "Requires authorised local fixture session",
);
test("P35 UI smoke: full preview on both surfaces, all required sizes", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "Explicit viewport matrix");
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=${encodeURIComponent("/import?source=sample")}`);
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      const form = page.locator('[data-import-ready="true"]');
      await expect(form).toBeVisible({ timeout: 60000 });
      await expect(
        page.getByRole("heading", { level: 1, name: "Import", exact: true }),
      ).toHaveCount(1);
      await expect(form.locator("[data-import-shot-preview]")).toContainText("5 parsed shots", {
        timeout: 30000,
      });
      await expect(form.getByRole("button", { name: "Save import", exact: true })).toBeDisabled();
      await expect(form.locator("[data-import-stepper]")).toContainText("Step 2 of 4");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P35-${surface}-${width}-top.png`) });
      await form.locator("[data-import-shot-preview]").scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`P35-${surface}-${width}-preview.png`) });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
      ).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});
