import { expect, test } from "@playwright/test";
test.skip(
  process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1",
  "Requires authorised local fixture session",
);
test("P02 Today UI: shared sections and viewport layout", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "Explicit viewport matrix");
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on(
    "pageerror",
    (error) => (errors.push(error.message), console.log("PAGEERROR", error.message)),
  );
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=${encodeURIComponent("/today?tab=overview")}`);
    const workspace = page.locator("[data-today-workspace-tabs]");
    await expect(workspace).toHaveAttribute("data-ready", "true", { timeout: 60000 });
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
      for (const label of ["Overview", "Practice", "Evidence", "Data quality"]) {
        await workspace.getByRole("tab", { name: label, exact: true }).click();
        await expect(workspace.getByRole("tab", { name: label, exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(workspace.getByRole("tabpanel")).toHaveCount(1);
      }
      await workspace.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`P02-${surface}-${width}-quality.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
    }
  }
  expect(errors).toEqual([]);
});
